import asyncio
import sys
import os

# Ensure we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# pyrefly: ignore [missing-import]
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def run_migration():
    print("Starting migration...")
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS push_device_token VARCHAR(255) DEFAULT NULL;"))
            await db.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notifications_cleared_at TIMESTAMPTZ DEFAULT NULL;"))
            await db.commit()
            print("Successfully added notifications_cleared_at and push_device_token to user_profiles")
        except Exception as e:
            print(f"Migration error or already exists: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
