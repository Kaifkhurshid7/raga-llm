"""Request and response schemas for the session endpoints."""
from datetime import datetime, timezone
from typing import List

from pydantic import BaseModel, ConfigDict, Field, field_validator


class _UTCModel(BaseModel):
    """Serializes naive datetimes (as returned by SQLite) as UTC."""

    @field_validator("created_at", "updated_at", check_fields=False)
    @classmethod
    def _assume_utc(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


class SessionSummary(_UTCModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    @field_validator("title", mode="before")
    @classmethod
    def _default_title(cls, v):
        return v or "Untitled chat"


class TurnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    user_message: str
    model_response: str
    model_version: str
    serving_condition: str


class SessionDetail(SessionSummary):
    turns: List[TurnOut]


class SessionRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title must not be blank")
        return v
