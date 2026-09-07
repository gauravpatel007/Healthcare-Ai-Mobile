# Server changes needed for the mobile fixes

The APK fixes alone cannot configure Twilio, change nginx, or register the
Android OAuth client. These changes have been prepared locally, not deployed.

## Profile images

On September 7, 2026, a GET to
`http://16.171.242.175/uploads/avatars/nonexistent-diagnostic.jpg` returned
HTTP 200 with the website HTML instead of an image/not-found response.

Back up the active nginx site configuration. Add the location in
`nginx-uploads.conf` to its existing LifeOS server block, using the same
backend upstream as the working `/api/` route. Validate with `sudo nginx -t`
before `sudo systemctl reload nginx`. A missing avatar should now return 404,
and a saved avatar should return an image content type. Keep uploads on the
existing persistent volume; do not recreate or delete that volume.

## SOS calls and SMS

Deploy the changed backend files and Compose configuration. The old router
returned success even when both Twilio functions returned false. The updated
router preserves failures, and the mobile app also detects legacy error text.

Compose previously did not forward Twilio settings into the app container.
Supply `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`
securely in the deployment environment, and set `PUBLIC_API_URL` to the
public backend origin. Do not put secrets in source control or screenshots.
Recreate the app service with the updated environment using the deployment's
normal procedure, preserving database/upload volumes. Confirm whether the
deployment actually uses Compose before using this procedure.

Inspect Twilio's messaging/call logs for the user's previous SOS attempts.
Check the sender's SMS/voice capabilities, destination permissions, account
balance, and any trial-recipient restrictions reported by Twilio. Provider
acceptance is not confirmed delivery. Do not trigger a real SOS as a test;
use an explicitly authorized test recipient and message.

## Google sign-in

The APK now uses Android Credential Manager and sends the Google ID token
back to the existing `/api/v1/auth/google` endpoint for verification. It does
not depend on Chrome sharing its cookies with the app.

In the Google Cloud project containing the existing web OAuth client, verify
or create an Android OAuth client with:

- Package: `com.lifeos.app`
- Debug certificate SHA-1: `AA:9C:DD:05:BF:27:D0:63:C3:63:30:4A:81:33:A4:FA:93:16:A9:67`
- Web/server client: `749609290729-7p9u9ujo98odpldasobtvqascmvejumb.apps.googleusercontent.com`

The SHA-1 above was read from this computer's debug signing certificate.
For a release or Play Store build, register that build's signing certificate
as well. Keep the server's GOOGLE_CLIENT_ID matched to the web client ID.
Verify an actual Google login on a device after configuration; compilation
cannot verify Cloud OAuth settings.

Reference: https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation
