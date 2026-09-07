"""
Admin Settings Router
Handles fetching and updating global system settings.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.admin import SystemSetting

router = APIRouter(prefix="/admin/settings", tags=["Admin Settings"])


@router.get("")
@router.get("/")
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    """Fetch all system settings and format as key-value pair."""
    result = await db.execute(select(SystemSetting))
    settings = result.scalars().all()
    
    # Format as a dictionary { "theme": "light", "support_email": "..." }
    settings_dict = {setting.key: setting.value for setting in settings}
    return {"status": "success", "data": settings_dict}


@router.put("")
@router.put("/")
async def update_settings(settings: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    """Update multiple settings at once from a dictionary of key-value pairs."""
    try:
        for key, value in settings.items():
            # Check if setting exists
            result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
            setting = result.scalars().first()
            
            val_str = str(value) if value is not None else ""
            
            if setting:
                setting.value = val_str
            else:
                new_setting = SystemSetting(key=key, value=val_str, category="general")
                db.add(new_setting)
        
        await db.commit()
        return {"status": "success", "message": "Settings updated successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
