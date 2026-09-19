# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends
# pyrefly: ignore [missing-import]
from sqlalchemy import select
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.notification import SystemNotification
from app.dependencies import CurrentUserId

router = APIRouter(prefix="/notifications", tags=["user-notifications"])

@router.get("")
async def get_my_notifications(user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    from app.models.user import UserProfile
    result_prof = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = result_prof.scalar_one_or_none()

    query = select(SystemNotification).where(
        SystemNotification.status == "Sent",
        SystemNotification.target_audience.in_(["Everyone", "Premium", "Selected Users", user_id]) 
    )

    if profile and profile.notifications_cleared_at:
        query = query.where(SystemNotification.created_at > profile.notifications_cleared_at)

    query = query.order_by(SystemNotification.created_at.desc())
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return notifications
