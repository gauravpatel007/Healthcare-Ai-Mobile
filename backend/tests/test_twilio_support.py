import unittest
from unittest.mock import patch, MagicMock

from app.config import Settings
from app.utils.twilio_support import configuration_error, normalize_phone, provider_error, public_audio_url
from app.utils.email import send_sos_sms_twilio, send_sos_call_twilio
from twilio.base.exceptions import TwilioRestException


def settings():
    return Settings(_env_file=None, TWILIO_ACCOUNT_SID='AC' + 'a' * 32,
                    TWILIO_AUTH_TOKEN='b' * 32, TWILIO_FROM_NUMBER='+15005550006')


class TwilioTests(unittest.TestCase):
    def test_dead_audio_url_falls_back_and_speaks_coordinates(self):
        client = MagicMock()
        with patch('app.utils.email.get_settings', return_value=settings()), patch('app.utils.twilio_support.create_client', return_value=client), patch('app.utils.twilio_support.audio_is_reachable', return_value=False):
            ok, message = send_sos_call_twilio(['9725259773'], 'A & B', 'https://www.google.com/maps?q=23.1,72.5', 'https://example.com/missing.mp3')
        self.assertTrue(ok)
        self.assertIn('Recording unavailable', message)
        xml = client.calls.create.call_args.kwargs['twiml']
        self.assertNotIn('<Play>', xml)
        self.assertIn('A &amp; B', xml)
        self.assertIn('Latitude 23.1. Longitude 72.5.', xml)

    def test_reachable_audio_keeps_recording_after_full_spoken_alert(self):
        client = MagicMock()
        with patch('app.utils.email.get_settings', return_value=settings()), patch('app.utils.twilio_support.create_client', return_value=client), patch('app.utils.twilio_support.audio_is_reachable', return_value=True):
            send_sos_call_twilio(['9725259773'], 'Test', audio_url='https://example.com/clip.mp3')
        xml = client.calls.create.call_args.kwargs['twiml']
        self.assertIn('<Play>https://example.com/clip.mp3</Play>', xml)
        self.assertIn('Please contact them immediately.', xml)

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
        url = urlsplit(request['url'])
        self.assertEqual(url.hostname, 'twimlets.com')
        xml = parse_qs(url.query)['Twiml'][0]
        self.assertIn('A &amp; B', xml)
        self.assertNotIn(config.TWILIO_AUTH_TOKEN, request['url'])
        self.assertIn('delivery is not guaranteed', xml)

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
