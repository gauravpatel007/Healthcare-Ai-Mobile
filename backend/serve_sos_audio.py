"""Local development audio-only origin: python serve_sos_audio.py --port 8011.

Point the public tunnel at this port, not at the full backend. Only existing SOS
audio files and the voice XML callback are served; no other APIs or listings.
"""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit, parse_qs

from app.utils.twilio_support import VOICE_TWIML_PATH, render_voice_twiml


def resolve_audio_path(request_path, audio_dir):
    path = urlsplit(request_path).path
    match = re.fullmatch(r'/uploads/sos_audio/([a-zA-Z0-9_.-]+\.(mp3|wav|ogg))', path)
    if not match or '..' in match[1]:
        return None
    root = Path(audio_dir).resolve()
    candidate = root / match[1]
    if candidate.is_symlink() or candidate.resolve().parent != root or not candidate.is_file():
        return None
    return candidate


def audio_handler(audio_dir):
    class AudioHandler(BaseHTTPRequestHandler):
        def do_HEAD(self):
            self.serve_audio(False)

        def do_GET(self):
            self.serve_audio(True)

        def do_POST(self):
            if urlsplit(self.path).path != VOICE_TWIML_PATH:
                self.send_error(404)
                return
            try:
                length = int(self.headers.get('Content-Length', 0))
            except ValueError:
                self.send_error(400)
                return
            if not 0 <= length <= 16000:
                self.send_error(413)
                return
            form = parse_qs(self.rfile.read(length).decode('utf-8'))
            self.serve_voice(True, form.get('Digits', [None])[0])

        def serve_voice(self, send_body, digits=None):
            query = parse_qs(urlsplit(self.path).query)
            try:
                xml = render_voice_twiml(query.get('twiml', [''])[0], digits or query.get('Digits', [None])[0])
            except ValueError as e:
                print(f"ValueError in serve_voice: {e}", flush=True)
                self.send_error(400)
                return
            content = xml.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if send_body:
                self.wfile.write(content)

        def serve_audio(self, send_body):
            if urlsplit(self.path).path == VOICE_TWIML_PATH:
                self.serve_voice(send_body)
                return
            path = resolve_audio_path(self.path, audio_dir)
            if path is None:
                self.send_error(404)
                return
            try:
                with path.open('rb') as audio:
                    self.send_response(200)
                    self.send_header('Content-Type', {'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'}[path.suffix])
                    self.send_header('Content-Length', str(path.stat().st_size))
                    self.send_header('X-Content-Type-Options', 'nosniff')
                    self.end_headers()
                    if send_body:
                        shutil.copyfileobj(audio, self.wfile)
            except (FileNotFoundError, BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, format, *args):
            print(f"[{self.log_date_time_string()}] {format % args}", flush=True)

    return AudioHandler


if __name__ == '__main__':
    from app.config import get_settings
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8011)
    args = parser.parse_args()
    root = Path(get_settings().UPLOAD_DIR) / 'sos_audio'
    server = ThreadingHTTPServer(('127.0.0.1', args.port), audio_handler(root))
    print(f'SOS audio-only server listening on 127.0.0.1:{args.port}', flush=True)
    server.serve_forever()
