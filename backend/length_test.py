from urllib.parse import urlencode
base_url='https://slackness-wilt-staple.ngrok-free.dev'
audio_url=f'{base_url}/uploads/sos_audio/14bccc3fda8242d89156530e724558ea.mp3'
spoken='Emergency Alert. Gaurav Patel has requested urgent help through LifeOS. Please contact them immediately.'
playback=f'<Play>{audio_url}</Play><Say voice="alice" language="en-US">{spoken}</Say><Hangup/>'
action=f'{base_url}/api/v1/emergency/echo-twiml?' + urlencode({'twiml': f'<Response>{playback}</Response>'})
action=action.replace('"', '&quot;')
twiml_content=f'<Response><Gather input="dtmf" numDigits="1" finishOnKey="" timeout="8" method="GET" action="{action}"><Say voice="alice" language="en-US">Emergency message. Press any key to listen to the saved voice message.</Say></Gather>{playback}</Response>'
final_url=f'{base_url}/api/v1/emergency/echo-twiml?' + urlencode({'twiml': twiml_content})
print("Final length:", len(final_url))
