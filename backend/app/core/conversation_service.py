"""
ConversationService (layer: application/service).

Pure orchestration: no FastAPI imports, no SQLAlchemy-specific query
syntax beyond what the repository exposes. This is the layer that
would be unit-tested without spinning up a web server or a real DB.
"""
from typing import List, Dict

from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.inference_client import InferenceClient
from app.models.conversation import Session as SessionModel, Turn

SYSTEM_PROMPT = (
    "You are RAGA, an assistant for Hindustani classical music. "
    "If you are not confident a fact is correct, say so plainly rather "
    "than guessing. If asked about a raga or term you don't recognize, "
    "say you can't confirm it exists rather than inventing details."
)


class ConversationService:
    def __init__(self, db: DBSession, inference_client: InferenceClient):
        self.db = db
        self.inference_client = inference_client

    def _get_or_create_session(self, session_id: str | None) -> SessionModel:
        if session_id:
            existing = self.db.get(SessionModel, session_id)
            if existing:
                return existing
        new_session = SessionModel()
        self.db.add(new_session)
        self.db.commit()
        return new_session

    def _history_as_messages(self, session: SessionModel) -> List[Dict[str, str]]:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in session.turns:
            messages.append({"role": "user", "content": turn.user_message})
            messages.append({"role": "assistant", "content": turn.model_response})
        return messages

    async def handle_message(self, session_id: str | None, message: str):
        session = self._get_or_create_session(session_id)
        history = self._history_as_messages(session)

        result = await self.inference_client.generate(
            history=history,
            message=message,
            serving_condition=settings.default_serving_condition,
        )

        turn = Turn(
            session_id=session.id,
            user_message=message,
            model_response=result.text,
            serving_condition=settings.default_serving_condition,
            model_version=result.model_version,
            decoding_config=result.decoding_config,
            prompt_tokens=result.prompt_tokens,
            output_tokens=result.output_tokens,
        )
        self.db.add(turn)
        self.db.commit()

        return session.id, result
