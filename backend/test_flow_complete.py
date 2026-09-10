import urllib.request
import urllib.parse
from xml.etree import ElementTree as ET

base_url = "https://slackness-wilt-staple.ngrok-free.dev"

# Test 1: Initial call POST (when Twilio connects)
qs = "twiml=%3CResponse%3E%3CGather%20input%3D%22dtmf%22%20numDigits%3D%221%22%20finishOnKey%3D%22%22%20timeout%3D%228%22%20method%3D%22GET%22%20action%3D%22https://slackness-wilt-staple.ngrok-free.dev/api/v1/emergency/echo-twiml?twiml%3D%3CResponse%3E%3CPlay%3Ehttps://slackness-wilt-staple.ngrok-free.dev/uploads/sos_audio/seed-user-001.mp3%3C/Play%3E%3CSay%20voice%3D'alice'%20language%3D'en-US'%3EEmergency%20Alert.%20Gaurav%20Patel%20has%20requested%20urgent%20help%20through%20LifeOS.%20Please%20contact%20them%20immediately.%3C/Say%3E%3CHangup/%3E%3C/Response%3E%22%3E%3CSay%20voice%3D'alice'%20language%3D'en-US'%3EEmergency%20message.%20Press%20any%20key%20to%20listen%20to%20the%20saved%20voice%20message.%3C/Say%3E%3C/Gather%3E%3CPlay%3Ehttps://slackness-wilt-staple.ngrok-free.dev/uploads/sos_audio/seed-user-001.mp3%3C/Play%3E%3CSay%20voice%3D'alice'%20language%3D'en-US'%3EEmergency%20Alert.%20Gaurav%20Patel%20has%20requested%20urgent%20help%20through%20LifeOS.%20Please%20contact%20them%20immediately.%3C/Say%3E%3CHangup/%3E%3C/Response%3E"

req1 = urllib.request.Request(f"{base_url}/api/v1/emergency/echo-twiml?{qs}", data=b"CallSid=CA12345", method="POST")
with urllib.request.urlopen(req1, timeout=5) as resp:
    print("Test 1 (Initial POST): Status =", resp.status)
    body1 = resp.read().decode('utf-8')
    root1 = ET.fromstring(body1)
    print("Test 1 verbs:", [node.tag for node in root1])

# Test 2: Action callback GET when digit 1 is pressed
action_twiml = "%3CResponse%3E%3CPlay%3Ehttps://slackness-wilt-staple.ngrok-free.dev/uploads/sos_audio/seed-user-001.mp3%3C/Play%3E%3CSay%20voice%3D'alice'%20language%3D'en-US'%3EEmergency%20Alert.%20Gaurav%20Patel%20has%20requested%20urgent%20help%20through%20LifeOS.%20Please%20contact%20them%20immediately.%3C/Say%3E%3CHangup/%3E%3C/Response%3E"
req2 = urllib.request.Request(f"{base_url}/api/v1/emergency/echo-twiml?twiml={action_twiml}&Digits=1", method="GET")
with urllib.request.urlopen(req2, timeout=5) as resp:
    print("Test 2 (Action GET with Digits): Status =", resp.status)
    body2 = resp.read().decode('utf-8')
    root2 = ET.fromstring(body2)
    print("Test 2 verbs:", [node.tag for node in root2])

# Test 3: Audio file GET / HEAD
audio_url = f"{base_url}/uploads/sos_audio/seed-user-001.mp3"
req3 = urllib.request.Request(audio_url, method="HEAD")
with urllib.request.urlopen(req3, timeout=5) as resp:
    print("Test 3 (Audio HEAD): Status =", resp.status, "Content-Type =", resp.headers.get('Content-Type'), "Length =", resp.headers.get('Content-Length'))

print("ALL TESTS COMPLETED!")
