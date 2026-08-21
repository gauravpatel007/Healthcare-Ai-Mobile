import os
import sys
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
# Import all models to ensure they are registered with Base
from app.models.user import User, UserProfile
from app.models.medical_record import MedicalRecord
from app.models.lab_metric import LabMetric

import asyncio

async def migrate():
    print("Migrating lab metrics...")
    
    # 1. Add ai_analyzed and ai_summary to medical_records if they don't exist
    async with engine.connect() as conn:
        try:
            await conn.execute(text("ALTER TABLE medical_records ADD COLUMN ai_analyzed BOOLEAN DEFAULT FALSE NOT NULL"))
            print("Added ai_analyzed column to medical_records")
        except Exception as e:
            print(f"Column ai_analyzed might already exist: {e}")
            
        try:
            await conn.execute(text("ALTER TABLE medical_records ADD COLUMN ai_summary TEXT"))
            print("Added ai_summary column to medical_records")
        except Exception as e:
            print(f"Column ai_summary might already exist: {e}")
            
        await conn.commit()
            
    # 2. Create the lab_metrics table
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Created lab_metrics table if it didn't exist")
    
    print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
