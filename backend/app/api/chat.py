"""Chat endpoints."""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_inference_client
from app.core.config import settings
from app.core.conversation_service import ConversationService
from app.core.inference_client import InferenceClient
from app.db.session import get_db
from app.models.conversation import Session as SessionModel
from app.schemas.chat import ChatRequest, ChatResponse, HistoryResponse, TurnOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    db: DBSession = Depends(get_db),
    inference_client: InferenceClient = Depends(get_inference_client),
) -> ChatResponse:
    service = ConversationService(db, inference_client)
    try:
        session_id, result = await service.handle_message(req.session_id, req.message)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Inference service timed out.")
    except httpx.HTTPError:
        logger.exception("Inference service call failed")
        raise HTTPException(status_code=502, detail="Inference service unavailable.")

    return ChatResponse(
        session_id=session_id,
        response=result.text,
        serving_condition=settings.default_serving_condition,
        model_version=result.model_version,
        decoding_config=result.decoding_config,
        prompt_tokens=result.prompt_tokens,
        output_tokens=result.output_tokens,
    )


@router.get("/sessions/{session_id}", response_model=HistoryResponse)
def get_session(session_id: str, db: DBSession = Depends(get_db)) -> HistoryResponse:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return HistoryResponse(
        session_id=session.id,
        turns=[
            TurnOut(
                user_message=t.user_message,
                model_response=t.model_response,
                model_version=t.model_version,
                serving_condition=t.serving_condition,
            )
            for t in session.turns
        ],
    )
