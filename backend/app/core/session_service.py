"""Session queries: listing, searching, updating, deleting."""
from typing import List, Optional

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


class SessionService:
    def __init__(self, db: DBSession) -> None:
        self.db = db

    def list_sessions(self, query: Optional[str] = None) -> List[SessionModel]:
        """Sessions that have at least one turn: pinned first, then most recently active."""
        stmt = select(SessionModel).where(
            exists().where(Turn.session_id == SessionModel.id)
        )
        if query and query.strip():
            pattern = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    SessionModel.title.ilike(pattern),
                    exists().where(
                        Turn.session_id == SessionModel.id,
                        or_(
                            Turn.user_message.ilike(pattern),
                            Turn.model_response.ilike(pattern),
                        ),
                    ),
                )
            )
        stmt = stmt.order_by(SessionModel.pinned.desc(), SessionModel.updated_at.desc())
        return list(self.db.scalars(stmt))

    def get(self, session_id: str) -> Optional[SessionModel]:
        return self.db.get(SessionModel, session_id)

    def update(
        self,
        session_id: str,
        title: Optional[str] = None,
        pinned: Optional[bool] = None,
    ) -> Optional[SessionModel]:
        """Rename and/or pin. Neither counts as activity, so `updated_at` is left alone."""
        session = self.get(session_id)
        if session is None:
            return None
        if title is not None:
            session.title = title
        if pinned is not None:
            session.pinned = pinned
        self.db.commit()
        return session

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
