"""Session endpoints: list, fetch, rename, delete."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session as DBSession

from app.core.session_service import SessionService
from app.db.session import get_db
from app.schemas.session import SessionDetail, SessionRename, SessionSummary

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Session not found.")


@router.get("", response_model=List[SessionSummary])
def list_sessions(
    q: Optional[str] = Query(default=None, max_length=100),
    db: DBSession = Depends(get_db),
):
    return SessionService(db).list_sessions(q)


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: str, db: DBSession = Depends(get_db)):
    session = SessionService(db).get(session_id)
    if session is None:
        raise _not_found()
    return session


@router.patch("/{session_id}", response_model=SessionSummary)
def rename_session(
    session_id: str, body: SessionRename, db: DBSession = Depends(get_db)
):
    session = SessionService(db).rename(session_id, body.title)
    if session is None:
        raise _not_found()
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, db: DBSession = Depends(get_db)) -> Response:
    if not SessionService(db).delete(session_id):
        raise _not_found()
    return Response(status_code=204)
