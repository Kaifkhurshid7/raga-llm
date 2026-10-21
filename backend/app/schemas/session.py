"""Request and response schemas for the session endpoints."""
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class _UTCModel(BaseModel):
    """Serializes naive datetimes (as returned by SQLite) as UTC."""

    @field_validator("created_at", "updated_at", "shared_at", check_fields=False)
    @classmethod
    def _assume_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        return v if v is None or v.tzinfo else v.replace(tzinfo=timezone.utc)


class SessionSummary(_UTCModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    pinned: bool = False
    archived: bool = False
    shared: bool = False
    snippet: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("title", mode="before")
    @classmethod
    def _default_title(cls, v):
        return v or "Untitled chat"


class TurnOut(_UTCModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: str
    created_at: datetime
    feedback: Optional[str] = None
    user_message: str
    model_response: str
    model_version: str
    serving_condition: str


class SessionDetail(SessionSummary):
    turns: List[TurnOut]


class SessionUpdate(BaseModel):
    """Partial update: send any of `title`, `pinned`, `archived`."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    pinned: Optional[bool] = None
    archived: Optional[bool] = None

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("title must not be blank")
        return v

    @model_validator(mode="after")
    def _something_to_change(self) -> "SessionUpdate":
        if self.title is None and self.pinned is None and self.archived is None:
            raise ValueError("send at least one of: title, pinned, archived")
        return self


class FeedbackIn(BaseModel):
    rating: Optional[Literal["up", "down"]] = None


class FeedbackOut(BaseModel):
    turn_id: str
    rating: Optional[str] = None


class ShareState(_UTCModel):
    enabled: bool
    token: Optional[str] = None
    shared_at: Optional[datetime] = None


class ShareRequest(BaseModel):
    rotate: bool = False


class SharedTurn(_UTCModel):
    """Only what a public reader may see: no ids, metadata, feedback or decoding details."""

    user_message: str
    model_response: str
    created_at: datetime


class SharedConversation(_UTCModel):
    title: str
    shared_at: Optional[datetime] = None
    turns: List[SharedTurn]
