"""Shared provider validation and safe errors; never expose credentials or request URLs."""
import re

from twilio.http.http_client import TwilioHttpClient
from twilio.rest import Client


def configuration_error(settings):
    if not all((settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_FROM_NUMBER)):
        return "SMS and calls are not configured on the server. Call your contact directly."
    if not re.fullmatch(r"AC[0-9a-fA-F]{32}", settings.TWILIO_ACCOUNT_SID):
        return "SMS and calls have an invalid server Account SID. Call your contact directly."
    if not re.fullmatch(r"[0-9a-fA-F]{32}", settings.TWILIO_AUTH_TOKEN):
        return "SMS and calls have an invalid server Auth Token. Call your contact directly."
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", settings.TWILIO_FROM_NUMBER):
        return "SMS and calls have an invalid sender number. Call your contact directly."
    return None


def create_client(settings):
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN,
                  http_client=TwilioHttpClient(timeout=10, max_retries=0))


def voice_instructions(settings, twiml):
    if settings.TWILIO_VOICE_USE_URL:
        from urllib.parse import urlencode
        return {'url': 'https://twimlets.com/echo?' + urlencode({'Twiml': twiml})}
    return {'twiml': twiml}


def audio_is_reachable(url):
    """Check what the provider will receive, without downloading an entire recording."""
    import requests
    try:
        with requests.get(url, timeout=(2, 3), stream=True, allow_redirects=False) as response:
            if response.status_code != 200:
                return False
            mime = response.headers.get('Content-Type', '').split(';')[0].lower()
            if mime not in ('audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'application/ogg'):
                return False
            header = next(response.iter_content(chunk_size=16), b'')
            return (header.startswith((b'ID3', b'OggS')) or
                    (header.startswith(b'RIFF') and header[8:12] == b'WAVE') or
                    (len(header) >= 2 and header[0] == 255 and header[1] & 224 == 224))
    except (requests.RequestException, StopIteration):
        return False


def provider_error(exc):
    code = getattr(exc, "code", None)
    reason = str(getattr(exc, "msg", "")).lower()
    # Trial feature denials can also use 401/20003: credentials may be valid.
    if "trial" in reason and any(term in reason for term in ("not available", "limited parameter", "disallowed", "upgrade")):
        return "This notification request is blocked by Twilio trial restrictions. Authentication alone does not enable this feature. Call your contact directly."
    if getattr(exc, "status", None) == 401 or code == 20003:
        return "SMS/call service authentication failed (Twilio 20003). The server credentials or account access must be repaired. Call your contact directly."
    if code == 21608:
        return "The recipient is not verified for this Twilio trial account. Call your contact directly."
    if code in (21211, 21614):
        return "The contact phone number is invalid or cannot receive this notification. Call your contact directly."
    if code in (21215, 21408):
        return "The notification service does not allow this destination. Call your contact directly."
    if code in (20005, 20429):
        return "The notification service is unavailable or rate limited. Call your contact directly."
    return "The notification request failed; delivery is not confirmed. Call your contact directly."


def public_audio_url(base_url, file_path):
    """Use spoken SOS when custom audio has no public origin for Twilio to fetch."""
    from urllib.parse import urlsplit, quote
    from ipaddress import ip_address
    try:
        parsed = urlsplit(base_url.strip())
        if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
            return None
        if parsed.hostname.lower() == 'localhost' or parsed.hostname.lower().endswith('.localhost'):
            return None
        try:
            if not ip_address(parsed.hostname).is_global:
                return None
        except ValueError:
            pass
        return f'{parsed.scheme}://{parsed.netloc}/uploads/{quote(file_path.lstrip("/"), safe="/")}'
    except (ValueError, AttributeError):
        return None


def normalize_phone(number):
    number = number.strip()
    if not re.fullmatch(r"\+?[0-9\s().-]+", number):
        raise ValueError("Invalid phone number")
    digits = re.sub(r"[^0-9]", "", number)
    if not number.startswith("+") and len(digits) == 10:
        digits = "91" + digits
    if not re.fullmatch(r"[1-9][0-9]{7,14}", digits):
        raise ValueError("Invalid phone number")
    return "+" + digits
