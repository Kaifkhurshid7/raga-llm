"""Conversation orchestration: session lookup, history, inference, persistence."""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.core.inference_client import GenerationResult, InferenceClient
from app.core.session_service import derive_title
from app.models.conversation import Session as SessionModel, Turn

SYSTEM_PROMPT = (
    "You are RAGA, an assistant for Hindustani classical music. "
    "If you are not confident a fact is correct, say so plainly rather "
    "than guessing. If asked about a raga or term you don't recognize, "
    "say you can't confirm it exists rather than inventing details."
)


class InvalidTurnIndex(ValueError):
    """`replace_from_turn` points past the end of the conversation."""


class ConversationService:
    def __init__(self, db: DBSession, inference_client: InferenceClient) -> None:
        self.db = db
        self.inference_client = inference_client

    async def handle_message(
        self,
        session_id: Optional[str],
        message: str,
        replace_from_turn: Optional[int] = None,
    ) -> Tuple[str, str, GenerationResult]:
        """Answer `message` in a session. Returns `(session_id, turn_id, result)`.

        With `replace_from_turn=k`, the model sees only the first k turns, and on success turn k
        and everything after it is replaced by the new turn. If generation fails nothing is
        changed, so a failed regenerate or edit never loses the existing answer.
        """
        session = self._get_or_create_session(session_id)
        turns = list(session.turns)

        keep = len(turns) if replace_from_turn is None else replace_from_turn
        if keep > len(turns):
            raise InvalidTurnIndex(
                f"replace_from_turn {keep} is beyond the {len(turns)} turns in this conversation"
            )

        result = await self.inference_client.generate(
            history=self._history_as_messages(turns[:keep]),
            message=message,
            serving_condition=settings.default_serving_condition,
        )

        for stale in turns[keep:]:
            self.db.delete(stale)
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
        # A title the user chose for a still-empty conversation is kept; otherwise the first turn names it.
        if not session.title or (keep == 0 and turns):
            session.title = derive_title(message)
        session.updated_at = datetime.now(timezone.utc)
        self.db.commit()

        return session.id, turn.id, result

    def _get_or_create_session(self, session_id: Optional[str]) -> SessionModel:
        if session_id:
            existing = self.db.get(SessionModel, session_id)
            if existing:
                return existing
        session = SessionModel()
        self.db.add(session)
        self.db.commit()
        return session

    @staticmethod
    def _history_as_messages(turns: Sequence[Turn]) -> List[Dict[str, str]]:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for turn in turns:
            messages.append({"role": "user", "content": turn.user_message})
            messages.append({"role": "assistant", "content": turn.model_response})
        return messages
