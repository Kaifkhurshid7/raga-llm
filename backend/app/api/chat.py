"""
Chat router (layer: interface/API).
Thin by design: validation + wiring only, no business logic here.
"""
import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.core.conversation_service import ConversationService
from app.core.inference_client import InferenceClient, MockInferenceClient
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["chat"])


def get_inference_client() -> InferenceClient:
    # Falls back to the mock client automatically if no inference
    # service URL is configured, so the API is runnable standalone
    # on a laptop with zero GPU dependency during development.
    if os.getenv("USE_MOCK_INFERENCE", "false").lower() == "true":
        return MockInferenceClient()
    return InferenceClient()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    db: DBSession = Depends(get_db),
    inference_client: InferenceClient = Depends(get_inference_client),
):
    service = ConversationService(db, inference_client)
    session_id, result = await service.handle_message(req.session_id, req.message)

    return ChatResponse(
        session_id=session_id,
        response=result.text,
        serving_condition=os.getenv("DEFAULT_SERVING_CONDITION", "baseline"),
        model_version=result.model_version,
        decoding_config=result.decoding_config,
        prompt_tokens=result.prompt_tokens,
        output_tokens=result.output_tokens,
    )
