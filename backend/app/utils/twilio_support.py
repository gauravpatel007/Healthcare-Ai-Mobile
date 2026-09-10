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
        # Keep the trial request minimal; the endpoint accepts Twilio's default
        # POST as well as GET callbacks from Gather.
        return {'url': twiml_url(settings.PUBLIC_API_URL, twiml)}
    return {'twiml': twiml}


def twiml_url(base_url, twiml):
    from urllib.parse import urlencode, urlsplit
    if not public_audio_url(base_url, 'sos_audio/probe.mp3'):
        raise ValueError('A public voice origin is required')
    parsed = urlsplit(base_url.strip())
    return f"{parsed.scheme}://{parsed.netloc}{VOICE_TWIML_PATH}?" + urlencode({'twiml': twiml})


VOICE_TWIML_PATH = '/api/v1/emergency/echo-twiml'


def render_voice_twiml(twiml, digits=None):
    from xml.etree import ElementTree as ET
    if len(twiml) > 16000 or '<!DOCTYPE' in twiml.upper():
        raise ValueError('Invalid voice instructions')
    try:
        root = ET.fromstring(twiml)
    except ET.ParseError:
        # Some clients/proxies unquote nested XML within attribute values (e.g. action="...?twiml=<Response>...")
        # Sanitize unescaped < and > within attribute quotes and retry parsing
        import re
        def fix_attr(match):
            name, val = match.group(1), match.group(2)
            val = val.replace('<', '&lt;').replace('>', '&gt;')
            return f'{name}="{val}"'
        cleaned = re.sub(r'([a-zA-Z_:][a-zA-Z0-9._:-]*)\s*=\s*"([^"]*)"', fix_attr, twiml)
        try:
            root = ET.fromstring(cleaned)
        except ET.ParseError as exc:
            raise ValueError('Invalid voice instructions') from exc
    if root.tag != 'Response':
        raise ValueError('Invalid voice instructions')
    # Defensive handling for a callback to the initial URL: any digit advances
    # directly to its playback siblings instead of replaying the prompt.
    if digits:
        for gather in root.findall('Gather'):
            root.remove(gather)
    return ET.tostring(root, encoding='unicode')


def voice_url_problem(url, expected_twiml):
    """Check the instructions endpoint before dialing, including tunnel HTML."""
    import requests
    try:
        with requests.get(url, timeout=(2, 3), stream=True, allow_redirects=False) as response:
            if response.status_code != 200:
                return f"Call not placed: the public voice URL returned HTTP {response.status_code}. Restore the public voice host and check PUBLIC_API_URL."
            content = bytearray()
            for chunk in response.iter_content(chunk_size=4096):
                content.extend(chunk)
                if len(content) > 16000:
                    return "Call not placed: the public voice URL returned an invalid response. Check PUBLIC_API_URL."
            if render_voice_twiml(content.decode('utf-8')) != render_voice_twiml(expected_twiml):
                return "Call not placed: the public voice URL did not return the expected call instructions. Check PUBLIC_API_URL."
    except (requests.RequestException, ValueError):
        return "Call not placed: the public voice URL is unreachable or returned invalid XML. Check PUBLIC_API_URL and the tunnel."
    return None


def recording_call_twiml(base_url, audio_url, spoken):
    """A digit must load playback, never reload the document containing Gather."""
    from xml.sax.saxutils import escape
    playback = f"<Play>{escape(audio_url)}</Play><Say voice='alice' language='en-US'>{spoken}</Say><Hangup/>"
    action = twiml_url(base_url, f'<Response>{playback}</Response>')
    prompt = escape("Emergency message. Press any key to listen to the saved voice message.")
    return (
        f'<Response>'
        f'<Gather input="dtmf" numDigits="1" finishOnKey="" timeout="8" method="GET" action="{escape(action)}">'
        f"<Say voice='alice' language='en-US'>{prompt}</Say>"
        f'</Gather>'
        f'{playback}'
        f'</Response>'
    )


def audio_url_problem(url):
    """Header-only check for the audio settings UI; never claim actual playback."""
    import requests
    if not url:
        return "Recording saved, but call audio is unavailable. The server needs a public audio address."
    try:
        response = requests.head(url, timeout=(2, 3), allow_redirects=False)
        with response:
            if response.status_code != 200:
                return f"Recording saved, but the call audio host returned HTTP {response.status_code}. The server's audio host needs repair."
            mime = response.headers.get('Content-Type', '').split(';')[0].strip().lower()
            if mime not in ('audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'application/ogg'):
                return "Recording saved, but the call audio address is not serving audio. The server's audio host needs repair."
    except requests.RequestException:
        return "Recording saved, but the call audio host could not be reached. The server's audio host needs repair."
    return None


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
    from requests.exceptions import RequestException
    if isinstance(exc, RequestException):
        return "The server could not reach Twilio; delivery is not confirmed. Call your contact directly."
    # Trial feature denials can also use 401/20003: credentials may be valid.
    if "trial" in reason and any(term in reason for term in ("not available", "limited parameter", "disallowed", "upgrade", "template", "pre-defined", "predefined")):
        return "This notification request is blocked by Twilio trial restrictions. Custom SOS SMS with location requires custom messaging to be enabled on the Twilio account. Call your contact directly."
    if getattr(exc, "status", None) == 401 or code == 20003:
        return "SMS/call service authentication failed (Twilio 20003). The server credentials or account access must be repaired. Call your contact directly."
    if code == 21608:
        return "The recipient is not verified for this Twilio trial account. Call your contact directly."
    if code in (21211, 21614):
        return "The contact phone number is invalid or cannot receive this notification. Call your contact directly."
    if code in (21215, 21408):
        return "The notification service does not allow this destination. Call your contact directly."
    if code in (21606, 21659, 21660, 21661):
        return f"The SMS sender is not valid for this account or is not SMS-capable (Twilio {code}). Configure the SMS sender in Twilio. Call your contact directly."
    if code == 21610:
        return "This recipient has opted out of SMS (Twilio 21610). Call your contact directly."
    if code == 30044:
        return "The SOS SMS exceeds this Twilio trial's message length limit (Twilio 30044). Enable full messaging to send the location SMS. Call your contact directly."
    if code in (30003, 30005, 30006, 30007, 30008):
        return f"The SOS SMS could not be delivered by the carrier (Twilio {code}). Check Twilio messaging logs. Call your contact directly."
    if code in (20005, 20429):
        return "The notification service is unavailable or rate limited. Call your contact directly."
    # Preserve only numeric codes, never raw errors containing credentials/URLs.
    detail = f" (Twilio {code})" if isinstance(code, int) else ""
    return f"The notification request failed{detail}; delivery is not confirmed. Check Twilio messaging logs for the rejection reason. Call your contact directly."


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
