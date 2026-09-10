"""Exercise actual HTTP routes and keypad transitions without placing calls."""
import unittest
from unittest.mock import patch, MagicMock
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers.emergency import router
from app.utils.twilio_support import recording_call_twiml, twiml_url, voice_url_problem


class VoiceFlowTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router, prefix='/api/v1')
        self.client = TestClient(app)
        self.origin = 'https://example.com'
        self.audio = self.origin + '/uploads/sos_audio/abc.mp3'
        self.xml = recording_call_twiml(self.origin, self.audio, 'Emergency alert.')
        self.url = twiml_url(self.origin, self.xml)

    def local_path(self, url):
        parsed = urlsplit(url)
        return parsed.path + '?' + parsed.query

    def assert_playback(self, response):
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/xml', response.headers['content-type'])
        root = ET.fromstring(response.text)
        self.assertEqual([node.tag for node in root], ['Play', 'Say', 'Hangup'])
        self.assertEqual(root[0].text, self.audio)
        self.assertNotIn('Press any key', response.text)

    def test_generated_url_resolves_and_every_key_goes_to_playback(self):
        self.assertEqual(urlsplit(self.url).path, '/api/v1/emergency/echo-twiml')
        response = self.client.get(self.local_path(self.url))
        self.assertEqual(response.status_code, 200)
        root = ET.fromstring(response.text)
        gather = root.find('Gather')
        self.assertEqual(gather.get('numDigits'), '1')
        self.assertEqual(gather.get('finishOnKey'), '')
        action = self.local_path(gather.get('action'))
        for digit in '0123456789*#':
            from urllib.parse import quote
            self.assert_playback(self.client.get(action + '&Digits=' + quote(digit)))
        # With no input, Twilio continues to the playback siblings after timeout.
        self.assertEqual([node.tag for node in root][1:], ['Play', 'Say', 'Hangup'])

    def test_post_fetch_and_stale_key_callback_do_not_loop(self):
        url = self.local_path(self.url)
        self.assertEqual(self.client.post(url).status_code, 200)
        self.assert_playback(self.client.post(url, data={'Digits': '1'}))
        self.assert_playback(self.client.get(url + '&Digits=2'))

    def test_invalid_twiml_is_rejected(self):
        self.assertEqual(self.client.get('/api/v1/emergency/echo-twiml', params={'twiml': '<html/>'}).status_code, 400)

    def test_nonpublic_origin_is_rejected_before_call_creation(self):
        for origin in ('', 'http://localhost:8000', 'http://127.0.0.1:8000'):
            with self.assertRaises(ValueError):
                twiml_url(origin, self.xml)

    def test_voice_probe_reports_http_html_and_xml_failures(self):
        expected = '<Response><Hangup/></Response>'
        with patch('requests.get') as get:
            response = get.return_value.__enter__.return_value
            response.status_code = 503
            self.assertIn('HTTP 503', voice_url_problem(self.url, expected))
            response.status_code = 200
            for body in (b'<html>tunnel warning</html>', b'broken XML', b'<Response><Say>Wrong instructions</Say></Response>'):
                response.iter_content.return_value = iter([body])
                self.assertIsNotNone(voice_url_problem(self.url, expected))
            response.iter_content.return_value = iter([expected.encode()])
            self.assertIsNone(voice_url_problem(self.url, expected))
