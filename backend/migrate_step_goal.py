import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:1234@localhost:5432/lifeos_db"

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Checking if step_goal exists...")
        try:
            await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN step_goal INTEGER NOT NULL DEFAULT 10000;"))
            print("Successfully added 'step_goal' column.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("Column 'step_goal' already exists.")
            else:
                print(f"Error adding column: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
