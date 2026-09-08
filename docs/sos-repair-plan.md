# SOS and deployment repair plan — 2026-09-08

Scope: implement and verify locally; do not deploy or send real SOS notifications.

1. Trace Twilio HTTP 401 / 20003 through configuration, SMS, voice, and the shared UI.
2. Make environment loading independent of the working directory, validate provider configuration, bound network waits, and return safe actionable errors. Preserve partial acceptance without claiming delivery.
3. Add a read-only provider diagnostic so credentials can be verified without placing calls or sending SMS.
4. Audit deployment configuration and production URLs; repair concrete defects and record external dependencies.
5. Run mocked backend regressions, frontend tests, and production builds. Record results and remaining verification in the repair report.

Initial findings: root and backend Twilio values match and have no surrounding whitespace. The reported authentication failure therefore still requires provider verification. Existing uncommitted user changes are outside this repair.
