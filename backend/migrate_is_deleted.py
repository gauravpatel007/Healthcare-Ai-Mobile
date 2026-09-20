import asyncio
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import create_async_engine
# pyrefly: ignore [missing-import]
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:1234@localhost:5432/lifeos_db"

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Checking if is_deleted exists...")
        try:
            await conn.execute(text("ALTER TABLE scanned_meals ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;"))
            print("Successfully added 'is_deleted' column.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("Column 'is_deleted' already exists.")
            else:
                print(f"Error adding column: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
