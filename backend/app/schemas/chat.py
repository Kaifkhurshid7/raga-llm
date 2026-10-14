"""Request and response schemas for the HTTP API."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatRequest(BaseModel):
    session_id: Optional[str] = Field(
        default=None, description="Existing session id; omit to start a new one."
    )
    message: str = Field(..., min_length=1, max_length=2000)

    @field_validator("message")
    @classmethod
    def _strip_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message must not be blank")
        return v


class ChatResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    session_id: str
    response: str
    serving_condition: str
    model_version: str
    decoding_config: Dict[str, Any]
    prompt_tokens: Optional[int] = None
    output_tokens: Optional[int] = None


class TurnOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    user_message: str
    model_response: str
    model_version: str
    serving_condition: str


class HistoryResponse(BaseModel):
    session_id: str
    turns: List[TurnOut]
