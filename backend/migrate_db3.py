import asyncio
# pyrefly: ignore [missing-import]
import asyncpg

async def run_migrations():
    conn = await asyncpg.connect(
        user='postgres',
        password='1234',
        database='lifeos_db',
        host='localhost',
        port=5432
    )

    try:
        print("Migrating users table...")
        await conn.execute('''
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500),
            ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) NOT NULL DEFAULT 'active',
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS premium_plan VARCHAR(50),
            ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
        ''')

        print("Migrating user_profiles table...")
        await conn.execute('''
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS chronic_conditions JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(100);
        ''')

        print("Migrating workout_plans table...")
        await conn.execute('''
            ALTER TABLE workout_plans 
            ADD COLUMN IF NOT EXISTS calories INTEGER,
            ADD COLUMN IF NOT EXISTS image VARCHAR(500),
            ADD COLUMN IF NOT EXISTS video VARCHAR(500);
        ''')

        print("Migrating exercises table...")
        await conn.execute('''
            ALTER TABLE exercises 
            ADD COLUMN IF NOT EXISTS image VARCHAR(500),
            ADD COLUMN IF NOT EXISTS video VARCHAR(500);
        ''')

        print("Migrating meal_plans table...")
        await conn.execute('''
            ALTER TABLE meal_plans 
            ADD COLUMN IF NOT EXISTS calories INTEGER,
            ADD COLUMN IF NOT EXISTS protein INTEGER,
            ADD COLUMN IF NOT EXISTS carbs INTEGER,
            ADD COLUMN IF NOT EXISTS fat INTEGER;
        ''')

        print("Migrating health_articles table...")
        await conn.execute('''
            ALTER TABLE health_articles 
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS image VARCHAR(255),
            ADD COLUMN IF NOT EXISTS author VARCHAR(255);
        ''')

        print("Migrating chat_messages table...")
        await conn.execute('''
            ALTER TABLE chat_messages 
            ADD COLUMN IF NOT EXISTS title VARCHAR(255),
            ADD COLUMN IF NOT EXISTS category VARCHAR(100),
            ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50),
            ADD COLUMN IF NOT EXISTS response_time INTEGER,
            ADD COLUMN IF NOT EXISTS feedback_rating INTEGER;
        ''')

        print("Migrating medical_records table...")
        await conn.execute('''
            ALTER TABLE medical_records 
            ADD COLUMN IF NOT EXISTS report_status VARCHAR(50),
            ADD COLUMN IF NOT EXISTS report_type VARCHAR(100),
            ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36),
            ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
        ''')

        print("Migrating mood_entries table...")
        await conn.execute('''
            ALTER TABLE mood_entries 
            ADD COLUMN IF NOT EXISTS mood_score INTEGER,
            ADD COLUMN IF NOT EXISTS notes TEXT;
        ''')

        print("All schema migrations completed successfully.")

    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(run_migrations())
