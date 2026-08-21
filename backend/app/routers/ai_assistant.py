"""
LifeOS Backend — AI Chat Doctor Router
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUserId
from app.models.chat import ChatMessage
from app.models.user import UserProfile
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse, ChatResponse, ChatFeedbackRequest, ChatSessionList
from app.services.ai_service import generate_ai_response

router = APIRouter(prefix="/ai/chat", tags=["AI Assistant"])

HEALTH_TIPS = [
    {"icon": "💧", "tip": "Drink at least 8 glasses of water daily to stay hydrated."},
    {"icon": "🏃", "tip": "Aim for 30 minutes of moderate exercise at least 5 days a week."},
    {"icon": "😴", "tip": "Adults need 7-9 hours of quality sleep each night."},
    {"icon": "🥗", "tip": "Fill half your plate with fruits and vegetables at every meal."},
    {"icon": "🧘", "tip": "Practice 10 minutes of mindfulness daily to reduce stress."},
    {"icon": "🦷", "tip": "Brush twice daily and floss once. Visit dentist every 6 months."},
    {"icon": "👁️", "tip": "Follow the 20-20-20 rule: every 20 min, look 20 feet away for 20 sec."},
    {"icon": "🩺", "tip": "Get an annual health checkup even if you feel perfectly fine."},
]


from datetime import datetime, timezone
import uuid

@router.post("", response_model=ChatResponse)
async def chat(data: ChatMessageCreate, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Send a message to the AI health assistant."""
    session_id = data.session_id or uuid.uuid4().hex
    
    # Generate title for new sessions based on first message
    title = data.message[:50] + "..." if len(data.message) > 50 else data.message
    
    # Save user message with explicit timestamp
    user_msg = ChatMessage(
        user_id=user_id, role="user", content=data.message, 
        module="assistant", created_at=datetime.now(timezone.utc),
        session_id=session_id, title=title
    )
    db.add(user_msg)
    await db.flush()

    # Get user context
    profile_r = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_r.scalar_one_or_none()
    context = ""
    if profile:
        context = f"Patient: {profile.name}, Age: {profile.age}, Gender: {profile.gender}, Blood Type: {profile.blood_type}, Conditions: {', '.join(profile.conditions) if profile.conditions else 'None'}, Allergies: {', '.join(profile.allergies) if profile.allergies else 'None'}"

    # Generate AI response
    response = await generate_ai_response("assistant", data.message, context=context)

    # Save assistant message with explicit timestamp
    assistant_msg = ChatMessage(
        user_id=user_id, role="assistant", content=response, 
        module="assistant", created_at=datetime.now(timezone.utc),
        session_id=session_id, title=title
    )
    db.add(assistant_msg)
    await db.flush()
    # The session will auto-commit via get_db()


    return ChatResponse(message_id=assistant_msg.id, response=response, session_id=session_id)

@router.post("/{message_id}/feedback")
async def chat_feedback(message_id: str, data: ChatFeedbackRequest, user_id: CurrentUserId, db: AsyncSession = Depends(get_db)):
    """Rate an AI response with thumbs up (+1) or thumbs down (-1)."""
    result = await db.execute(select(ChatMessage).where(ChatMessage.id == message_id, ChatMessage.user_id == user_id))
    msg = result.scalar_one_or_none()
    if msg:
        msg.feedback = data.feedback
        await db.flush()
        return {"success": True}
    return {"success": False, "error": "Message not found"}

@router.post("/public")
async def public_chat(data: ChatMessageCreate):
    """Public endpoint for landing page demo chat."""
    context = "This is a prospective user on the LifeOS landing page. Be highly welcoming, explain features briefly, and encourage them to sign up. Do not provide specific medical advice without a disclaimer."
    
    # Generate AI response
    response = await generate_ai_response("assistant", data.message, context=context)
    
    return {"response": response}


@router.get("/sessions", response_model=list[ChatSessionList])
async def chat_sessions(user_id: CurrentUserId, limit: int = 5, db: AsyncSession = Depends(get_db)):
    """Get the latest chat sessions."""
    # We fetch the first message of each session to get the title and date
    result = await db.execute(
        select(
            ChatMessage.session_id, 
            func.min(ChatMessage.title).label('title'),
            func.min(ChatMessage.created_at).label('created_at'),
            func.count(ChatMessage.id).label('message_count')
        ).where(
            ChatMessage.user_id == user_id, 
            ChatMessage.module == "assistant",
            ChatMessage.session_id.isnot(None)
        ).group_by(ChatMessage.session_id)
        .order_by(func.min(ChatMessage.created_at).desc())
        .limit(limit)
    )
    rows = result.all()
    sessions = []
    for row in rows:
        sessions.append({
            "session_id": row.session_id,
            "title": row.title or "Chat Session",
            "created_at": row.created_at,
            "message_count": row.message_count
        })
    return sessions

@router.get("/history", response_model=list[ChatMessageResponse])
async def chat_history(user_id: CurrentUserId, session_id: str | None = None, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Get chat history."""
    query = select(ChatMessage).where(
        ChatMessage.user_id == user_id, ChatMessage.module == "assistant"
    )
    if session_id:
        query = query.where(ChatMessage.session_id == session_id)
    
    result = await db.execute(query.order_by(ChatMessage.created_at.desc()).limit(limit))
    messages = result.scalars().all()
    return list(reversed(messages))


@router.delete("/history")
async def clear_history(user_id: CurrentUserId, session_id: str | None = None, db: AsyncSession = Depends(get_db)):
    """Clear chat history."""
    query = select(ChatMessage).where(
        ChatMessage.user_id == user_id, ChatMessage.module == "assistant"
    )
    if session_id:
        query = query.where(ChatMessage.session_id == session_id)
        
    result = await db.execute(query)
    messages = result.scalars().all()
    for msg in messages:
        await db.delete(msg)
    # The session will auto-commit via get_db()
    return {"success": True, "message": "Chat history cleared", "deleted_count": len(messages)}


@router.get("/tips")
async def health_tips():
    """Get daily health tips."""
    return {"tips": HEALTH_TIPS}
