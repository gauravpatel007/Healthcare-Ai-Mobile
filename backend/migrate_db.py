import asyncio
# pyrefly: ignore [missing-import]
import asyncpg

async def run_migrations():
    # Connect to the database
    conn = await asyncpg.connect(
        user='postgres',
        password='1234',
        database='lifeos_db',
        host='localhost',
        port=5432
    )

    try:
        # Alter users table
        await conn.execute('''
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
        ''')
        print("Added is_phone_verified and is_deleted to users table.")

        # Alter user_profiles table
        await conn.execute('''
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
        ''')
        print("Added phone to user_profiles table.")

    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(run_migrations())
