import urllib.request
import urllib.parse

qs = "twiml=%3CResponse%3E%3CGather%20input%3D%22dtmf%22%20numDigits%3D%221%22%20finishOnKey%3D%22%22%20timeout%3D%228%22%20method%3D%22GET%22%20action%3D%22https://slackness-wilt-staple.ngrok-free.dev/api/v1/emergency/echo-twiml?twiml%3D%3CResponse%3E%3CPlay%3Ehttps://slackness-wilt-staple.ngrok-free.dev/uploads/sos_audio/seed-user-001.mp3%3C/Play%3E%3CSay%20voice%3D'alice'%20language%3D'en-US'%3EEmergency%20Alert.%20Gaurav%20Patel%20has%20requested%20urgent%20help%20through%20LifeOS.%20Please%20contact%20them%20immediately.%3C/Say%3E%3CHangup/%3E%3C/Response%3E%22%3E%3CSay%20voice%3D'alice'%20language%3D'en-US'%3EEmergency%20message.%20Press%20any%20key%20to%20listen%20to%20the%20saved%20voice%20message.%3C/Say%3E%3C/Gather%3E%3CPlay%3Ehttps://slackness-wilt-staple.ngrok-free.dev/uploads/sos_audio/seed-user-001.mp3%3C/Play%3E%3CSay%20voice%3D'alice'%20language%3D'en-US'%3EEmergency%20Alert.%20Gaurav%20Patel%20has%20requested%20urgent%20help%20through%20LifeOS.%20Please%20contact%20them%20immediately.%3C/Say%3E%3CHangup/%3E%3C/Response%3E"

for base_url in ["http://127.0.0.1:8012", "https://slackness-wilt-staple.ngrok-free.dev"]:
    url = f"{base_url}/api/v1/emergency/echo-twiml?{qs}"
    req = urllib.request.Request(url, data=b"CallSid=CA12345", method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"{base_url} -> Status: {resp.status}")
            body = resp.read().decode('utf-8')
            print(f"Body length: {len(body)}")
            print("First 150 chars:", body[:150])
    except Exception as e:
        print(f"{base_url} -> Error: {e}")
