from app.utils.twilio_support import render_voice_twiml
from urllib.parse import urlencode, parse_qs, urlsplit
from xml.sax.saxutils import escape

base_url = 'https://slackness-wilt-staple.ngrok-free.dev'
audio_url = f'{base_url}/uploads/sos_audio/14bccc3fda8242d89156530e724558ea.mp3'
spoken = 'Emergency Alert. Gaurav Patel has requested urgent help through LifeOS. Please contact them immediately.'
playback = f'<Play>{audio_url}</Play><Say voice="alice" language="en-US">{spoken}</Say><Hangup/>'
action = f'{base_url}/api/v1/emergency/echo-twiml?' + urlencode({'twiml': f'<Response>{playback}</Response>'})
action_escaped = escape(action)
prompt = escape('Emergency message. Press any key to listen to the saved voice message.')
twiml_content = f'<Response><Gather input="dtmf" numDigits="1" finishOnKey="" timeout="8" method="GET" action="{action_escaped}"><Say voice="alice" language="en-US">{prompt}</Say></Gather>{playback}</Response>'

final_url = f'{base_url}/api/v1/emergency/echo-twiml?' + urlencode({'twiml': twiml_content})
print("Final URL length:", len(final_url))
qs = parse_qs(urlsplit(final_url).query)
received_twiml = qs['twiml'][0]

try:
    rendered = render_voice_twiml(received_twiml)
    print("Rendered OK:")
    print(rendered)
except Exception as e:
    print("Render FAILED:", type(e), e)
