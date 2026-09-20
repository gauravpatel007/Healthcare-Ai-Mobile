"""Create only the consent table. Existing contacts stay pending by default.

Run from backend: python migrate_emergency_consent.py
Normal application startup also creates this table through init_db().
"""
import asyncio
from app.database import Base, engine
import app.models  # noqa: F401
from app.models.emergency import EmergencyContactConsent


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync: Base.metadata.create_all(sync, tables=[EmergencyContactConsent.__table__]))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
