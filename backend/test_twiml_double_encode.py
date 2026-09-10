import urllib.parse
from urllib.parse import quote, urlsplit, parse_qs
from xml.sax.saxutils import escape
from xml.etree import ElementTree as ET

base_url = 'https://slackness-wilt-staple.ngrok-free.dev'
audio_url = f'{base_url}/uploads/sos_audio/seed-user-001.mp3'
spoken = 'Emergency Alert. Gaurav Patel has requested urgent help through LifeOS. Please contact them immediately.'
playback = f'<Play>{escape(audio_url)}</Play><Say voice="alice" language="en-US">{spoken}</Say><Hangup/>'
playback_xml = f'<Response>{playback}</Response>'

# Action double-encoded so that unquoting query doesn't produce unescaped XML in attribute
action_twiml_param = quote(quote(playback_xml))
action = f'{base_url}/api/v1/emergency/echo-twiml?twiml={action_twiml_param}'
prompt = escape('Emergency message. Press any key to listen to the saved voice message.')
twiml_content = f'<Response><Gather input="dtmf" numDigits="1" finishOnKey="" timeout="8" method="GET" action="{escape(action)}"><Say voice="alice" language="en-US">{prompt}</Say></Gather>{playback}</Response>'

# Outer URL encoding
full_url = f'{base_url}/api/v1/emergency/echo-twiml?' + urllib.parse.urlencode({'twiml': twiml_content})
print('Full URL length:', len(full_url))

# Now simulate what the server receives on initial call:
query = parse_qs(urlsplit(full_url).query)
received_twiml = query['twiml'][0]
print('Can ElementTree parse received_twiml?')
root = ET.fromstring(received_twiml)
print('YES! Parsed cleanly. Root tag:', root.tag)

# Now simulate what Twilio requests when key is pressed (Twilio hits action):
gather = root.find('Gather')
action_url = gather.get('action')
print('Action URL from Gather:', action_url[:80])
action_query = parse_qs(urlsplit(action_url).query)
action_received_twiml = action_query['twiml'][0]
action_root = ET.fromstring(action_received_twiml)
print('YES! Action XML parsed cleanly! Tags:', [n.tag for n in action_root])
