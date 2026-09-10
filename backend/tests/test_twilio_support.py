import unittest
from unittest.mock import patch, MagicMock

from app.config import Settings
from app.utils.twilio_support import configuration_error, normalize_phone, provider_error, public_audio_url
from app.utils.email import send_sos_sms_twilio, send_sos_call_twilio
# pyrefly: ignore [missing-import]
from twilio.base.exceptions import TwilioRestException


def settings():
    return Settings(_env_file=None, TWILIO_ACCOUNT_SID='AC' + 'a' * 32,
                    TWILIO_AUTH_TOKEN='b' * 32, TWILIO_FROM_NUMBER='+15005550006', PUBLIC_API_URL='https://example.com')


class TwilioTests(unittest.TestCase):
    def setUp(self):
        self.voice_probe = self.enterContext(patch('app.utils.twilio_support.voice_url_problem', return_value=None))
        self.audio_probe = self.enterContext(patch('app.utils.twilio_support.audio_url_problem', return_value=None))

    def test_sms_body_and_destination_include_actual_location(self):
        client = MagicMock()
        client.messages.create.return_value.status = 'queued'
        location = 'https://www.google.com/maps?q=23.0207834,72.4622436'
        with patch('app.utils.email.get_settings', return_value=settings()), patch('app.utils.twilio_support.create_client', return_value=client):
            ok, message = send_sos_sms_twilio(['97252 59773'], 'Gaurav Patel', location)
        self.assertTrue(ok)
        client.messages.create.assert_called_once_with(
            body='🚨SOS: Gaurav Patel needs urgent help. Loc: ' + location,
            from_='+15005550006', to='+919725259773')
        self.assertNotIn('delivered', message)


        client = MagicMock()
        client.messages.create.side_effect = [MagicMock(status='queued'), TwilioRestException(400, '/private', code=21608)]
        with patch('app.utils.email.get_settings', return_value=settings()), patch('app.utils.twilio_support.create_client', return_value=client):
            ok, message = send_sos_sms_twilio(['9725259773', '9725259774'], 'Test')
        self.assertTrue(ok)
        self.assertIn('SMS requests accepted: 1.', message)

    def test_sender_and_unknown_errors_include_only_safe_codes(self):
        for code in (21660, 21661, 30044, 99999):
            message = provider_error(TwilioRestException(400, '/private', msg='secret raw details', code=code))
            self.assertIn(str(code), message)
            self.assertNotIn('secret', message)
            self.assertNotIn('/private', message)

    def test_reachable_audio_plays_after_one_key(self):
        client = MagicMock()
        with patch('app.utils.email.get_settings', return_value=settings()), patch('app.utils.twilio_support.create_client', return_value=client):
            send_sos_call_twilio(['9725259773'], 'Test', audio_url='https://example.com/clip.mp3')
        xml = client.calls.create.call_args.kwargs['twiml']
        self.assertIn('<Play>https://example.com/clip.mp3</Play>', xml)
        from xml.etree import ElementTree
        root = ElementTree.fromstring(xml)
        self.assertEqual([node.tag for node in root], ['Gather', 'Play', 'Say', 'Hangup'])
        self.assertIn('Press any key', xml)
        self.assertEqual(root[0].get('numDigits'), '1')
        self.assertEqual(root[0].get('finishOnKey'), '')
        self.assertNotIn('SMS', xml)

    def test_unavailable_voice_url_prevents_a_broken_call(self):
        config = settings()
        config.TWILIO_VOICE_USE_URL = True
        self.voice_probe.return_value = 'Call not placed: the public voice URL returned HTTP 503.'
        client = MagicMock()
        with patch('app.utils.email.get_settings', return_value=config), patch('app.utils.twilio_support.create_client', return_value=client):
            ok, message = send_sos_call_twilio(['9725259773'], 'Test')
        self.assertFalse(ok)
        self.assertIn('503', message)
        client.calls.create.assert_not_called()

    def test_unavailable_recording_uses_spoken_alert_without_a_key_loop(self):
        self.audio_probe.return_value = 'Recording host returned HTTP 503.'
        client = MagicMock()
        with patch('app.utils.email.get_settings', return_value=settings()), patch('app.utils.twilio_support.create_client', return_value=client):
            ok, message = send_sos_call_twilio(['9725259773'], 'Test', audio_url='https://example.com/clip.mp3')
        self.assertTrue(ok)
        self.assertIn('Recording unavailable', message)
        xml = client.calls.create.call_args.kwargs['twiml']
        self.assertNotIn('Gather', xml)
        self.assertNotIn('Play', xml)

    def test_audio_probe_rejects_html_and_accepts_mp3(self):
        from app.utils.twilio_support import audio_is_reachable
        with patch('requests.get') as get:
            response = get.return_value.__enter__.return_value
            response.status_code = 404
            self.assertFalse(audio_is_reachable('https://example.com/audio'))
            response.status_code = 200
            response.headers = {'Content-Type': 'text/html'}
            self.assertFalse(audio_is_reachable('https://example.com/audio'))
            response.headers = {'Content-Type': 'audio/mpeg'}
            response.iter_content.return_value = iter([b'ID3' + b'\x00' * 13])
            self.assertTrue(audio_is_reachable('https://example.com/audio'))

    def test_url_mode_recording_has_no_keypress_loop(self):
        from urllib.parse import urlsplit, parse_qs
        from xml.etree import ElementTree
        config = settings()
        config.TWILIO_VOICE_USE_URL = True
        client = MagicMock()
        audio = 'https://example.com/clip.mp3?v=2&format=mp3'
        with patch('app.utils.email.get_settings', return_value=config), patch('app.utils.twilio_support.create_client', return_value=client):
            ok, _ = send_sos_call_twilio(['9725259773'], 'Test', audio_url=audio)
        self.assertTrue(ok)
        client.calls.create.assert_called_once()
        xml = parse_qs(urlsplit(client.calls.create.call_args.kwargs['url']).query)['twiml'][0]
        root = ElementTree.fromstring(xml)
        self.assertEqual([node.tag for node in root], ['Gather', 'Play', 'Say', 'Hangup'])
        self.assertEqual(root[1].text, audio)
        playback = ElementTree.fromstring(parse_qs(urlsplit(root[0].get('action')).query)['twiml'][0])
        self.assertEqual([node.tag for node in playback], ['Play', 'Say', 'Hangup'])
        self.assertEqual(playback[0].text, audio)
        self.assertIsNone(playback.find('Gather'))

    def test_template_only_trial_does_not_substitute_sms(self):
        config = settings()
        config.TWILIO_SMS_TEMPLATE_ONLY = True
        with patch('app.utils.email.get_settings', return_value=config), patch('app.utils.twilio_support.create_client') as client:
            ok, message = send_sos_sms_twilio(['9725259773'], 'Test', 'https://www.google.com/maps?q=23,72')
        self.assertFalse(ok)
        self.assertIn('location SMS was not sent', message)
        client.assert_not_called()

    def test_trial_voice_uses_url_preserving_escaped_instructions(self):
        from urllib.parse import urlsplit, parse_qs
        config = settings()
        config.TWILIO_VOICE_USE_URL = True
        client = MagicMock()
        with patch('app.utils.email.get_settings', return_value=config), patch('app.utils.twilio_support.create_client', return_value=client):
            self.assertTrue(send_sos_call_twilio(['9725259773'], 'A & B')[0])
        request = client.calls.create.call_args.kwargs
        self.assertNotIn('twiml', request)
        self.assertNotIn('method', request)
        url = urlsplit(request['url'])
        self.assertEqual(parse_qs(url.query)['twiml'][0], '<Response><Say voice=\'alice\' language=\'en-US\'>Emergency Alert. A &amp; B has requested urgent help through LifeOS. Please contact them immediately.</Say><Hangup/></Response>')
        self.assertNotIn(config.TWILIO_AUTH_TOKEN, request['url'])
        self.assertNotIn('Gather', parse_qs(url.query)['twiml'][0])
        self.assertNotIn('SMS', parse_qs(url.query)['twiml'][0])

    def test_trial_denial_is_not_misreported_as_bad_credentials(self):
        for status, code, reason in [(400, 0, 'Invalid or disallowed parameters provided - trial accounts have limited parameter access'), (401, 20003, 'This feature is not available on a Trial account. Please upgrade your account')]:
            result = provider_error(TwilioRestException(status, '/private', msg=reason, code=code))
            self.assertIn('trial restrictions', result)
            self.assertNotIn('authentication failed', result)

    def test_private_audio_falls_back_to_spoken_alert(self):
        for base in ['', 'http://localhost:8000', 'http://127.0.0.1:8000', 'http://192.168.1.2', 'http://[::1]']:
            self.assertIsNone(public_audio_url(base, 'sos_audio/test.mp3'))
        self.assertEqual(public_audio_url('https://example.com/api/v1', 'sos_audio/test file.mp3'), 'https://example.com/uploads/sos_audio/test%20file.mp3')

    def test_validation_and_trim(self):
        config = settings()
        self.assertIsNone(configuration_error(config))
        config.TWILIO_AUTH_TOKEN = 'placeholder'
        self.assertIn('Auth Token', configuration_error(config))
        self.assertEqual(Settings(_env_file=None, TWILIO_AUTH_TOKEN=' token ').TWILIO_AUTH_TOKEN, 'token')

    def test_phone_normalization(self):
        self.assertEqual(normalize_phone('97252 59773'), '+919725259773')
        self.assertEqual(normalize_phone('+91 (97252) 59773'), '+919725259773')
        with self.assertRaises(ValueError):
            normalize_phone('not a phone')

    def test_authentication_is_safe_and_stops_repeated_requests(self):
        exc = TwilioRestException(401, '/Accounts/private/Messages.json', msg='Authenticate', code=20003)
        self.assertNotIn('/Accounts/', provider_error(exc))
        for send, resource in [(send_sos_sms_twilio, 'messages'), (send_sos_call_twilio, 'calls')]:
            client = MagicMock()
            getattr(client, resource).create.side_effect = exc
            with patch('app.utils.email.get_settings', return_value=settings()), patch('app.utils.twilio_support.create_client', return_value=client):
                ok, message = send(['9725259773', '9725259774'], 'Test')
            self.assertFalse(ok)
            self.assertIn('20003', message)
            self.assertNotIn('\x1b', message)
            self.assertEqual(getattr(client, resource).create.call_count, 1)

    def test_partial_acceptance_and_no_contacts(self):
        for send, resource in [(send_sos_sms_twilio, 'messages'), (send_sos_call_twilio, 'calls')]:
            client = MagicMock()
            getattr(client, resource).create.side_effect = [MagicMock(sid='test'), RuntimeError('private details')]
            with patch('app.utils.email.get_settings', return_value=settings()), patch('app.utils.twilio_support.create_client', return_value=client):
                ok, message = send(['9725259773', '9725259774'], 'Test')
                self.assertFalse(send([], 'Test')[0])
            self.assertTrue(ok)
            self.assertIn('Failed: 1', message)
            self.assertNotIn('private details', message)
