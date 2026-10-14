"""Session queries: listing, searching, renaming, deleting."""
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
        """Sessions that have at least one turn, most recently active first."""
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
        stmt = stmt.order_by(SessionModel.updated_at.desc())
        return list(self.db.scalars(stmt))

    def get(self, session_id: str) -> Optional[SessionModel]:
        return self.db.get(SessionModel, session_id)

    def rename(self, session_id: str, title: str) -> Optional[SessionModel]:
        session = self.get(session_id)
        if session is None:
            return None
        session.title = title
        self.db.commit()
        return session

    def delete(self, session_id: str) -> bool:
        session = self.get(session_id)
        if session is None:
            return False
        self.db.delete(session)
        self.db.commit()
        return True
