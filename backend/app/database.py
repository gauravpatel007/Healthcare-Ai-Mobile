"""
LifeOS Backend — Database Configuration
SQLAlchemy async engine, session factory, and base model.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings

settings = get_settings()

engine_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

engine_kwargs["pool_size"] = 20
engine_kwargs["max_overflow"] = 10

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class TimestampMixin:
    """Mixin providing created_at and updated_at columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


async def get_db():
    """Dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables (for development only; use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        from sqlalchemy import text
        await conn.execute(text("ALTER TABLE medicine_reminder_notices ADD COLUMN IF NOT EXISTS push_sent BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(text("ALTER TABLE medicine_reminder_notices ADD COLUMN IF NOT EXISTS push_attempts INTEGER NOT NULL DEFAULT 0"))
        # Safely add email column to emergency_contacts if missing (pseudo-migration)
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS email VARCHAR(255);"))
            await conn.execute(text("ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS carrier VARCHAR(50);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(32);"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_alerts_enabled BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS connected_devices JSON DEFAULT '[]'::json;"))
            await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS fitbit_access_token TEXT;"))
            await conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS fitbit_refresh_token TEXT;"))
            await conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ai_prep_notes TEXT;"))
            await conn.execute(text("ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS family_member_id VARCHAR(36);"))
            await conn.execute(text("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS feedback INTEGER;"))
            try:
                # For PostgreSQL to update the ENUM
                await conn.execute(text("ALTER TYPE health_category ADD VALUE IF NOT EXISTS 'mindfulness';"))
            except Exception:
                pass
        except Exception as e:
            import logging
            logging.getLogger("lifeos").warning(f"DB Migration step skipped: {e}")


async def close_db():
    """Dispose of the engine connection pool."""
    await engine.dispose()
