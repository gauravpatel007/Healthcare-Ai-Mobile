# September 19 recovery

The 18:54 IST reference commit is `f66c1ad`. Rolling back to it alone does
not repair the deployment: the dashboard argument mismatch already exists there.

The active server checkout is
`/home/ubuntu/Healthcare-Ai-Mobile/Healthcare-Ai-Mobile`.
It was launched without its environment files, so Compose selected its fallback
Docker database and empty AI credentials. The original Supabase data remains
available. Keep the Docker database volume too: it contains records created
while the app was connected to the alternate database.

Before updating, verify the deployment `.env` exists in the checkout actually
used by Compose, and that it points to the intended database. Never replace it
with `.env.example`. `DATABASE_URL` and `SECRET_KEY` are now required so an
unconfigured checkout fails before starting. AI Chat also needs `GROQ_API_KEY`.

From the active checkout, validate without printing secrets:

```sh
docker-compose config --quiet
docker-compose up -d --no-deps app
```

For a backend source-only update using the existing bind mount, restart `app`.
Environment changes require recreating the container, not merely restarting it.
Do not remove database volumes or import the old dump to resolve this incident.

Existing app sessions issued against the alternate database/signing key may need
one sign-out and sign-in using the original account after recovery.

Regression checks (run from `backend`):

```sh
python -m unittest discover -s tests -p test_dashboard.py -v
python -m unittest discover -s tests -p test_recovery.py -v
python -m unittest discover -s tests -p test_deployment_config.py -v
```
