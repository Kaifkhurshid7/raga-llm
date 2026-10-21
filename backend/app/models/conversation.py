"""ORM models for chat sessions and turns."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text, false
from sqlalchemy.orm import relationship

from app.db.session import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=True)
    pinned = Column(Boolean, nullable=False, default=False, server_default=false())
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now)

    turns = relationship(
        "Turn",
        back_populates="session",
        order_by="Turn.created_at",
        cascade="all, delete-orphan",
    )


class Turn(Base):
    """A user message and the model's reply, with the generation metadata."""

    __tablename__ = "turns"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)

    user_message = Column(Text, nullable=False)
    model_response = Column(Text, nullable=False)

    serving_condition = Column(String, nullable=False)
    model_version = Column(String, nullable=False)
    decoding_config = Column(JSON, nullable=False)
    prompt_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=_now)

    session = relationship("Session", back_populates="turns")
