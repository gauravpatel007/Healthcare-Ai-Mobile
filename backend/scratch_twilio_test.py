import urllib.request
import urllib.parse

twiml = '<Response><Play>https://slackness-wilt-staple.ngrok-free.dev/uploads/sos_audio/14bccc3fda8242d89156530e724558ea.mp3</Play><Say voice="alice" language="en-US">Emergency Alert</Say><Hangup/></Response>'
url = 'https://slackness-wilt-staple.ngrok-free.dev/api/v1/emergency/echo-twiml?' + urllib.parse.urlencode({'twiml': twiml})
data = urllib.parse.urlencode({'Digits': '1', 'CallSid': 'CA12345'}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'User-Agent': 'TwilioProxy/1.1', 'Content-Type': 'application/x-www-form-urlencoded'})
try:
    res = urllib.request.urlopen(req, timeout=5)
    print('Status:', res.getcode())
    print('Body:', res.read().decode('utf-8'))
except Exception as e:
    print('Error:', e)
