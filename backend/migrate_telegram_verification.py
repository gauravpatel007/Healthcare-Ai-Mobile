"""Idempotent migration limited to emergency contact phone verification.

Run before starting an existing installation: python migrate_telegram_verification.py
Existing contacts intentionally become pending; consent records are unchanged.
"""
import asyncio
from sqlalchemy import inspect, text
from app.database import engine
from app.models.emergency import EmergencyContact, TelegramVerificationSession


def migrate(connection):
    EmergencyContact.__table__.create(connection, checkfirst=True)
    columns = {column["name"] for column in inspect(connection).get_columns("emergency_contacts")}
    timestamp = "TIMESTAMP WITH TIME ZONE" if connection.dialect.name == "postgresql" else "TIMESTAMP"
    additions = {
        "verification_status": "VARCHAR(20) NOT NULL DEFAULT 'pending'",
        "telegram_verified": "BOOLEAN NOT NULL DEFAULT FALSE",
        "telegram_chat_id": "BIGINT",
        "verified_at": timestamp,
        "verification_token_hash": "VARCHAR(64)",
        "verification_expires_at": timestamp,
        "verification_requested_at": timestamp,
        "verification_attempts": "INTEGER NOT NULL DEFAULT 0",
    }
    for name, definition in additions.items():
        if name not in columns:
            connection.execute(text(f"ALTER TABLE emergency_contacts ADD COLUMN {name} {definition}"))
    connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_emergency_contacts_verification_token_hash ON emergency_contacts (verification_token_hash)"))
    TelegramVerificationSession.__table__.create(connection, checkfirst=True)
    session_columns = {column["name"] for column in inspect(connection).get_columns("telegram_verification_sessions")}
    if "confirmed_at" not in session_columns:
        connection.execute(text(f"ALTER TABLE telegram_verification_sessions ADD COLUMN confirmed_at {timestamp}"))


async def main():
    async with engine.begin() as connection:
        await connection.run_sync(migrate)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
