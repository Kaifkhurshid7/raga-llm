"""Session queries: listing, searching, updating, deleting."""
import secrets
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session as DBSession

from app.models.conversation import Session as SessionModel, Turn

_TITLE_WORDS = 6
_TITLE_MAX_CHARS = 60


def derive_title(message: str) -> str:
    """Build a short title from the first words of a message."""
    words = message.split()
    title = " ".join(words[:_TITLE_WORDS])
    if len(title) > _TITLE_MAX_CHARS:
        title = title[: _TITLE_MAX_CHARS - 1].rstrip() + "…"
    elif len(words) > _TITLE_WORDS:
        title += "…"
    return title or "Untitled chat"


_SNIPPET_RADIUS = 60
_MAX_PAGE = 100


def _escape_like(text: str) -> str:
    """Make `%` and `_` in user input match literally."""
    return text.replace("\\", "\\\\").replace("%", "\%").replace("_", "\_")


def make_snippet(text: str, needle: str) -> Optional[str]:
    """A short excerpt of `text` around the first case-insensitive match of `needle`."""
    flat = " ".join(text.split())
    at = flat.lower().find(needle.lower())
    if at < 0:
        return None
    start = max(0, at - _SNIPPET_RADIUS)
    end = min(len(flat), at + len(needle) + _SNIPPET_RADIUS)
    return ("…" if start else "") + flat[start:end] + ("…" if end < len(flat) else "")


class SessionService:
    def __init__(self, db: DBSession) -> None:
        self.db = db

    def list_sessions(
        self,
        query: Optional[str] = None,
        archived: bool = False,
        limit: int = 30,
        offset: int = 0,
    ) -> List[Tuple[SessionModel, Optional[str]]]:
        """Sessions that have at least one turn: pinned first, then most recently active.

        Returns `(session, snippet)` pairs; the snippet is set only when the search matched message
        text rather than the title.
        """
        stmt = select(SessionModel).where(
            exists().where(Turn.session_id == SessionModel.id),
            SessionModel.archived_at.is_not(None) if archived else SessionModel.archived_at.is_(None),
        )
        needle = query.strip() if query else ""
        if needle:
            pattern = f"%{_escape_like(needle)}%"
            stmt = stmt.where(
                or_(
                    SessionModel.title.ilike(pattern, escape="\\"),
                    exists().where(
                        Turn.session_id == SessionModel.id,
                        or_(
                            Turn.user_message.ilike(pattern, escape="\\"),
                            Turn.model_response.ilike(pattern, escape="\\"),
                        ),
                    ),
                )
            )
        stmt = stmt.order_by(SessionModel.pinned.desc(), SessionModel.updated_at.desc(), SessionModel.id)
        stmt = stmt.limit(max(1, min(limit, _MAX_PAGE))).offset(max(0, offset))

        results: List[Tuple[SessionModel, Optional[str]]] = []
        for session in self.db.scalars(stmt):
            snippet = None
            if needle and needle.lower() not in (session.title or "").lower():
                for turn in session.turns:
                    snippet = make_snippet(turn.user_message, needle) or make_snippet(
                        turn.model_response, needle
                    )
                    if snippet:
                        break
            results.append((session, snippet))
        return results

    def create(self) -> SessionModel:
        """An empty conversation, so a new chat can be shared or renamed before its first message.

        It stays out of the history list until it has a turn.
        """
        session = SessionModel()
        self.db.add(session)
        self.db.commit()
        return session

    def get(self, session_id: str) -> Optional[SessionModel]:
        return self.db.get(SessionModel, session_id)

    def update(
        self,
        session_id: str,
        title: Optional[str] = None,
        pinned: Optional[bool] = None,
        archived: Optional[bool] = None,
    ) -> Optional[SessionModel]:
        """Rename, pin and/or archive. None counts as activity, so `updated_at` is left alone."""
        session = self.get(session_id)
        if session is None:
            return None
        if title is not None:
            session.title = title
        if pinned is not None:
            session.pinned = pinned
        if archived is not None:
            session.archived_at = datetime.now(timezone.utc) if archived else None
        self.db.commit()
        return session

    def set_feedback(self, session_id: str, turn_id: str, rating: Optional[str]) -> bool:
        turn = self.db.get(Turn, turn_id)
        if turn is None or turn.session_id != session_id:
            return False
        turn.feedback = rating
        turn.feedback_at = datetime.now(timezone.utc) if rating else None
        self.db.commit()
        return True

    def enable_share(self, session_id: str, rotate: bool = False) -> Optional[SessionModel]:
        """Turn public sharing on, or with `rotate` replace the token so the old link stops working."""
        session = self.get(session_id)
        if session is None:
            return None
        if rotate or not session.share_token:
            session.share_token = secrets.token_urlsafe(24)
            session.shared_at = datetime.now(timezone.utc)
            self.db.commit()
        return session

    def revoke_share(self, session_id: str) -> bool:
        session = self.get(session_id)
        if session is None:
            return False
        session.share_token = None
        session.shared_at = None
        self.db.commit()
        return True

    def get_shared(self, token: str) -> Optional[SessionModel]:
        if not token:
            return None
        return self.db.scalars(select(SessionModel).where(SessionModel.share_token == token)).first()

    def delete(self, session_id: str) -> bool:
        session = self.get(session_id)
        if session is None:
            return False
        self.db.delete(session)
        self.db.commit()
        return True

    def backfill_titles(self) -> int:
        """Give conversations that predate titles a title from their first message."""
        stmt = select(SessionModel).where(
            or_(SessionModel.title.is_(None), SessionModel.title == ""),
            exists().where(Turn.session_id == SessionModel.id),
        )
        updated = 0
        for session in self.db.scalars(stmt):
            session.title = derive_title(session.turns[0].user_message)
            updated += 1
        if updated:
            self.db.commit()
        return updated
