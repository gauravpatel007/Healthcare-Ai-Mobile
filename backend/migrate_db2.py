import asyncio
# pyrefly: ignore [missing-import]
import asyncpg

async def run_migrations():
    # Connect to the database
    conn = await asyncpg.connect(
        user='postgres',
        password='123',
        database='lifeos_db',
        host='localhost',
        port=5432
    )

    try:
        # ChatMessage columns
        print("Adding columns to chat_messages...")
        await conn.execute('''
            ALTER TABLE chat_messages 
            ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS feedback INTEGER;
        ''')
        
        # Create ai_prompts
        print("Creating ai_prompts...")
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS ai_prompts (
                id VARCHAR(36) PRIMARY KEY,
                module VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
        ''')
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS ix_ai_prompts_module ON ai_prompts (module);
        ''')
        
        # Create ai_prompt_versions
        print("Creating ai_prompt_versions...")
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS ai_prompt_versions (
                id VARCHAR(36) PRIMARY KEY,
                prompt_id VARCHAR(36) NOT NULL REFERENCES ai_prompts(id) ON DELETE CASCADE,
                module VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                version INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
        ''')
        await conn.execute('''
            CREATE INDEX IF NOT EXISTS ix_ai_prompt_versions_prompt_id ON ai_prompt_versions (prompt_id);
        ''')
        
        print("Migration successful.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_migrations())
