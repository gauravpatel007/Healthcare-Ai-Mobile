import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:1234@localhost:5432/lifeos_db")

async def migrate():
    print(f"Connecting to {DATABASE_URL}...")
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE chat_messages ADD COLUMN session_id VARCHAR(36)"))
            print("Successfully added session_id column to chat_messages.")
        except Exception as e:
            print(f"Error executing ALTER TABLE: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
