import asyncio
import json
from app.database import engine
# pyrefly: ignore [missing-import]
from sqlalchemy import text

async def test():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id FROM users WHERE email = 'gaurav@lifeos.com'"))
        uid = res.scalar()
        if not uid:
            print('No gaurav')
            return
        
        tables = ['user_profiles', 'emergency_contacts', 'medicines', 'medicine_doses', 'chat_messages', 'appointments', 'health_trackers', 'medical_records']
        counts = {}
        for t in tables:
            try:
                res = await conn.execute(text(f"SELECT COUNT(1) FROM {t} WHERE user_id = '{uid}'"))
                counts[t] = res.scalar()
            except Exception as e:
                counts[t] = str(e)
        print(json.dumps(counts, indent=2))

if __name__ == "__main__":
    asyncio.run(test())
