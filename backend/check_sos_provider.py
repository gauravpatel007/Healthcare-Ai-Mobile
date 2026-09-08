"""Read-only Twilio diagnostic. Run from backend: python check_sos_provider.py.

Fetches account status only. Never sends SMS or initiates calls; never prints secrets.
"""
from app.config import get_settings
from app.utils.twilio_support import configuration_error, create_client, provider_error


def main():
    settings = get_settings()
    if error := configuration_error(settings):
        print(error)
        return 1
    try:
        account = create_client(settings).api.accounts(settings.TWILIO_ACCOUNT_SID).fetch()
        print(f"Twilio authentication accepted. Account status: {account.status}.")
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
