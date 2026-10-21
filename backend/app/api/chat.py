"""Chat endpoints."""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.api.deps import get_inference_client
from app.core.config import settings
from app.core.conversation_service import ConversationService, InvalidTurnIndex
from app.core.inference_client import InferenceClient
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse

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
        session_id, result = await service.handle_message(
            req.session_id, req.message, req.replace_from_turn
        )
    except InvalidTurnIndex as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Inference service timed out.")
    except httpx.HTTPError:
        logger.exception("Inference service call failed")
        raise HTTPException(status_code=502, detail="Inference service unavailable.")
    except (KeyError, TypeError, ValueError):
        logger.exception("Inference service returned an unexpected response")
        raise HTTPException(
            status_code=502, detail="Inference service returned an unexpected response."
        )

    return ChatResponse(
        session_id=session_id,
        response=result.text,
        serving_condition=settings.default_serving_condition,
        model_version=result.model_version,
        decoding_config=result.decoding_config,
        prompt_tokens=result.prompt_tokens,
        output_tokens=result.output_tokens,
    )
