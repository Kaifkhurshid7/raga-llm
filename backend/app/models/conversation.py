"""
ORM models (layer: domain entities, persisted via SQLAlchemy).
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import relationship

from app.db.session import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime, default=datetime.utcnow)

    turns = relationship("Turn", back_populates="session", order_by="Turn.created_at")


class Turn(Base):
    """
    One user message + one model response, with full generation metadata
    kept alongside it -- this is what makes later evaluation auditable:
    every stored answer says exactly which model/adapter and which
    decoding config produced it.
    """
    __tablename__ = "turns"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)

    user_message = Column(Text, nullable=False)
    model_response = Column(Text, nullable=False)

    serving_condition = Column(String, nullable=False)   # baseline | few_shot | rag | finetuned
    model_version = Column(String, nullable=False)       # e.g. "llama-3.1-8b-instruct-base"
    decoding_config = Column(JSON, nullable=False)        # logged verbatim from inference-service
    prompt_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="turns")
