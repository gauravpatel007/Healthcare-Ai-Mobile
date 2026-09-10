import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from app.utils.twilio_support import audio_url_problem
from app.routers.emergency import audio_clip_response
from serve_sos_audio import resolve_audio_path


class AudioAvailabilityTests(unittest.IsolatedAsyncioTestCase):
    def test_header_check_reports_dead_tunnel_and_html(self):
        with patch('requests.head') as head:
            response = head.return_value
            response.status_code = 503
            self.assertIn('HTTP 503', audio_url_problem('https://example.com/audio'))
            response.status_code = 200
            response.headers = {'Content-Type': 'text/html'}
            self.assertIn('not serving audio', audio_url_problem('https://example.com/audio'))
            response.headers = {'Content-Type': 'audio/mpeg'}
            self.assertIsNone(audio_url_problem('https://example.com/audio'))
        self.assertIn('public audio address', audio_url_problem(None))

    async def test_saved_clip_response_distinguishes_storage_from_call_availability(self):
        now = datetime.now(timezone.utc)
        clip = SimpleNamespace(id='clip', user_id='user', file_path='sos_audio/abc.mp3',
                               original_filename='help.mp3', created_at=now, updated_at=now)
        with tempfile.TemporaryDirectory() as folder:
            config = SimpleNamespace(UPLOAD_DIR=folder, PUBLIC_API_URL='https://example.com')
            with patch('app.routers.emergency.get_settings', return_value=config), patch('app.utils.twilio_support.audio_url_problem') as probe:
                response = await audio_clip_response(clip)
                self.assertFalse(response.call_audio_ready)
                self.assertIn('missing', response.call_audio_message)
                probe.assert_not_called()
                target = Path(folder) / clip.file_path
                target.parent.mkdir()
                target.write_bytes(b'ID3test')
                probe.return_value = 'Audio host returned HTTP 503'
                response = await audio_clip_response(clip)
                self.assertFalse(response.call_audio_ready)
                self.assertIn('503', response.call_audio_message)
                probe.return_value = None
                response = await audio_clip_response(clip)
                self.assertTrue(response.call_audio_ready)

    def test_audio_origin_excludes_backend_and_other_files(self):
        with tempfile.TemporaryDirectory() as folder:
            audio = Path(folder) / 'abcd-1234.mp3'
            audio.write_bytes(b'ID3test')
            self.assertEqual(resolve_audio_path('/uploads/sos_audio/abcd-1234.mp3', folder), audio.resolve())
            for path in ('/', '/api/v1/emergency/contacts', '/uploads/sos_audio/',
                         '/uploads/sos_audio/../.env', '/uploads/sos_audio/%2e%2e/.env',
                         '/uploads/sos_audio/not-present.mp3', '/uploads/documents/abcd.pdf'):
                self.assertIsNone(resolve_audio_path(path, folder), path)
