# Building the Android app

The APK needs an absolute backend URL. The Vite development proxy is not
included in the APK; `/api/v1` alone points to the phone's local app server.

Create `.env.android` in this directory:

```dotenv
VITE_API_URL=http://16.171.242.175/api/v1
VITE_API_BASE_URL=http://16.171.242.175
```

These are the server addresses verified on September 7, 2026. Update them if
the deployment changes. Environment files are ignored by Git. Use an HTTPS
backend for production to encrypt login credentials and health data in transit.

From this directory, run:

```powershell
npm run build:android
cd android
.\gradlew.bat assembleDebug
```

Install `android/app/build/outputs/apk/debug/app-debug.apk` on the phone.
The Android build validates the API URL and copies the new web assets into the
native project. Rebuilding only in Android Studio does not update those assets.

The backend must allow CORS origin `http://localhost` (the origin configured
for this Android app), credentials, and the request headers `Content-Type`,
`Authorization`, and `Bypass-Tunnel-Reminder`. The current server passed the
login preflight check. A LAN backend must be reachable from the phone's Wi-Fi;
`localhost` and `127.0.0.1` refer to the phone, not your computer.
