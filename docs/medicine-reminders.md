# Medicines and Reminders update

## Task list

- [x] 1. Equal-width icon buttons, Medicines / Reminders tabs, existing theme.
- [x] 2. Detect an older hosted API; stop repeated missing-endpoint polling and gate the notification bell.
- [x] 3. Show saved medicine schedules even while the reminder API is awaiting deployment.
- [x] 4a. Implement dose records, taken / skipped / snoozed actions, corrections, stock and refill reminders.
- [x] 4b. Android local recurrence, permission controls, reboot recovery, notification actions and offline action journal.
- [x] 4c. 12 backend tests and 4 compatibility tests; web production build; Android debug APK build.
- [ ] 4d. Deploy the updated backend to the configured hosted server and verify against it.
- [ ] 4e. Verify alarm delivery and reboot recovery on an Android device/emulator.

## Deployment

The frontend currently targets the hosted API configured in `frontend-react/.env`.
Updating local Python files does not update that server. Its public API schema was
checked during this change and does not include `/api/v1/reminders` yet.

Deploy the backend changes and root requirements together using the existing server
deployment procedure. In the server's Python environment, from the backend directory:

```sh
python -m pip install -r ../requirements.txt
python migrate_reminders.py
```

Restart the existing FastAPI service/container using its normal deployment procedure.
The migration only adds reminder tables/columns; it does not delete existing medicines.
Confirm the new reminder routes appear in `/openapi.json`, then click **Check for update**
in Reminders or reload the frontend. Keep the same API/database to retain saved medicines.

For Android, build the frontend, copy assets and build the Android project:

```sh
npm run build
npx cap copy android
```

Then build/run the Android app in Android Studio. Grant Notifications and Alarms & reminders
from the Reminders settings. Use **Test notification** and a scheduled test dose.

## Behavior

- Dose identities use medicine ID, calendar date and time. Action IDs make retrying requests safe.
- Schedule timezone is an IANA zone; instants are stored in UTC. Changing phone timezone does
  not silently shift the medicine schedule. Spring DST gaps move forward by the gap; repeated
  fall times trigger once using the earlier offset.
- Weekly schedules use the medicine start weekday. As-needed medicines have no repeating alarms.
- A missed status means no dose action was recorded within the selected logging window; it
  is not advice about how late a medicine can be taken. History starts when reminders are enabled.
- Automatic stock deduction applies to tablets/capsules only, with configurable units per dose.
- Native Android delivery and the legacy server push channel are mutually exclusive per selected
  reminder device. The server still keeps a private in-app reminder feed.
- Native notification actions survive process death in app-private storage and sync when LifeOS
  reconnects. Logout/account switching clears local schedules and cached data.
- Android force-stop, disabled notification channels, revoked permissions or device restrictions
  can prevent/delay delivery. Permission state is shown in Reminders. This is not an alarm guarantee.
- Browser notifications use the existing OneSignal integration; a successful device registration
  and configured server credentials are required. Browser preview mode does not simulate native alarms.
- With an older backend the schedule is read-only. No false successful dose saves or notification
  registration are displayed. Use the update check after deploying the new API.

## Verification

```sh
# From backend, uses an isolated in-memory SQLite DB:
python -m unittest discover -s tests -p test_reminders.py -v
# From frontend-react:
node --test qa/reminderCompatibility.test.mjs
npm run build
```

The tests require `aiosqlite` in the test Python environment.
Mobile layout was checked at 360px and 412px, desktop at 1024px, and both light/dark themes.
The snooze interaction was checked in the synthetic UI fixture. No Android device or emulator
was connected for delivery/reboot checks. The debug APK is at
`frontend-react/android/app/build/outputs/apk/debug/app-debug.apk`.
The development-only `/qa/medicine.html` fixture uses synthetic data and in-memory API
responses. Add `?legacy=1&tab=reminders` to test an older backend. This page is not an entry
point in the production build. No account data or remote API calls are used in this fixture.

On this Windows host Java's default socket temp directory failed during Gradle startup.
The build succeeded with `_JAVA_OPTIONS` setting `jdk.net.unixdomain.tmpdir` to the
workspace's `scratch` directory; this workaround is process-local, not a project setting.
