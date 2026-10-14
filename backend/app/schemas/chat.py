"""
Pydantic request/response schemas (layer: interface/API boundary).
These are what the outside world sees; they are deliberately separate
from the ORM models so persistence details never leak into the API
contract.
"""
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    session_id: Optional[str] = Field(
        default=None, description="Existing session id, or omit to start a new one"
    )
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    session_id: str
    response: str
    serving_condition: str
    model_version: str
    decoding_config: Dict[str, Any]
    prompt_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
