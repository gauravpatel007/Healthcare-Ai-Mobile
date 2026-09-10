"""Read-only Twilio diagnostic. Run from backend: python check_sos_provider.py.

Fetches account status and optionally recent SMS status. Never sends notifications
or prints credentials, phone numbers, message bodies, or precise locations.
"""
import argparse
from app.config import get_settings
from app.utils.twilio_support import configuration_error, create_client, provider_error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recent-sms', action='store_true', help='Read the five most recent SMS statuses and error codes')
    parser.add_argument('--voice-url', action='store_true', help='Check public voice XML routing without placing a call or fetching audio')
    args = parser.parse_args()
    settings = get_settings()
    if args.voice_url:
        from app.utils.twilio_support import twiml_url, voice_url_problem
        probe = '<Response><Hangup/></Response>'
        try:
            problem = voice_url_problem(twiml_url(settings.PUBLIC_API_URL, probe), probe)
        except ValueError:
            problem = 'PUBLIC_API_URL must be a public HTTP(S) origin.'
        print(problem or 'Public voice URL returned valid call instructions. No call was placed.')
        return 1 if problem else 0
    if error := configuration_error(settings):
        print(error)
        return 1
    try:
        client = create_client(settings)
        account = client.api.accounts(settings.TWILIO_ACCOUNT_SID).fetch()
        print(f"Twilio authentication accepted. Account status: {account.status}. Type: {account.type}.")
        print(f"Local template-only SMS setting: {settings.TWILIO_SMS_TEMPLATE_ONLY}.")
        if str(account.type).lower() == 'trial':
            print('Current Twilio trials only permit preset SMS templates; custom SOS text and Maps links require custom messaging access.')
            print('See https://www.twilio.com/docs/usage/trials/try-out-sms')
        if args.recent_sms:
            messages = client.messages.list(limit=5)
            if not messages:
                print('No recent SMS records. Rejected API requests may not create a message record.')
            for message in messages:
                print(f'SMS: {message.date_created}; status={message.status}; error_code={message.error_code}')
        print("No notifications sent. Sender capabilities, destination permissions and delivery still require verification.")
        return 0 if account.status == "active" else 1
    except Exception as exc:
        from requests.exceptions import RequestException
        if isinstance(exc, RequestException):
            print("Cannot reach Twilio. Check network/proxy connectivity; credentials were not verified.")
            return 1
        print(provider_error(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
