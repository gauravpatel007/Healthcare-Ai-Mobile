# SOS voice diagnosis and applied fixes

## Confirmed causes

- Generated call URLs omitted `/v1`: `/api/emergency/echo-twiml` returned 404, while the registered `/api/v1/emergency/echo-twiml` returned 200 locally.
- The voice endpoint only accepted GET. Outbound calls use Twilio's default POST unless overridden. The endpoint now accepts GET and POST; call creation keeps the minimal URL request for trial compatibility.
- The configured public origin `https://angry-hairs-sniff.loca.lt` returned HTTP 503 even for a harmless Hangup-only document. Localhost being healthy does not make that URL reachable to Twilio.
- A Gather that submits back to its initial document can restart its prompt. Playback now has a separate destination, and any keypad callback to the initial endpoint strips the Gather before responding.

Twilio's diagnostic-alert API was unavailable on this trial (20003, trial feature restriction), so these are direct code and HTTP findings, not attribution of a particular call-log event.

## Applied behavior

The application asks for one key, then returns Play, Say, and Hangup. All digits, star, and hash are accepted. No input falls through to playback after eight seconds. Twilio's own trial announcement is provider-controlled; the tests establish application behavior, not a guaranteed total number of provider prompts.

A bounded public voice-URL check runs before placing URL-dependent calls. HTTP errors, tunnel HTML, invalid XML, and mismatched instructions produce a specific failure rather than a broken call. If voice routing works but audio is unavailable, a spoken SOS is used and the recording problem is reported. The spoken alert no longer falsely claims an SMS was sent.

Saved recording responses include audio availability for the existing UI. New uploads receive unique filenames so provider media caching does not reuse an earlier selection.

The optional local `backend/serve_sos_audio.py` host supports SOS recordings and the same voice XML callback. Other APIs and directory listings remain excluded. Its public tunnel has not been started: earlier automatic approval review requires explicit user consent to expose recordings.

## Validation and remaining prerequisite

All 42 backend tests passed. Subsequent focused tests passed after retaining the minimal trial call request. HTTP checks against the running localhost backend returned 200 for both GET and POST; a POST with Digits=1 returned exactly Play, Say, Hangup and no key prompt. Tests exercised the actual routes for every keypad key, plus callbacks to the initial URL.

No live SMS or call was sent. Public voice/audio hosting still needs to be restored before handset playback can be verified. The pending approval is to expose only the SOS voice/audio host through a temporary tunnel; anyone with a recording URL could retrieve it while public.

Read-only diagnostic from backend:

```powershell
..\venv\Scripts\python.exe check_sos_provider.py --voice-url
```

References: [Twilio Gather](https://www.twilio.com/docs/voice/twiml/gather), [Call resource](https://www.twilio.com/docs/voice/api/call-resource), [HTTP retrieval failure](https://www.twilio.com/docs/api/errors/10800).
