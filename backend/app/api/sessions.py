"""Session endpoints: list, fetch, update (rename, pin, archive), delete, feedback, sharing."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session as DBSession

from app.core.rate_limit import RateLimiter
from app.core.session_service import SessionService
from app.db.session import get_db
from app.schemas.session import (
    FeedbackIn,
    FeedbackOut,
    SessionDetail,
    SessionSummary,
    SessionUpdate,
    ShareRequest,
    ShareState,
    SharedConversation,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])
shared_router = APIRouter(prefix="/api/shared", tags=["shared"])

# Public endpoint: limits token guessing. Share management: limits churn.
shared_limiter = RateLimiter(limit=30, window_seconds=60)
share_admin_limiter = RateLimiter(limit=30, window_seconds=60)


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Session not found.")


def _share_state(session) -> ShareState:
    return ShareState(
        enabled=bool(session.share_token), token=session.share_token, shared_at=session.shared_at
    )


@router.get("", response_model=List[SessionSummary])
def list_sessions(
    q: Optional[str] = Query(default=None, max_length=100),
    archived: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: DBSession = Depends(get_db),
):
    rows = SessionService(db).list_sessions(q, archived=archived, limit=limit, offset=offset)
    return [
        SessionSummary.model_validate(session).model_copy(update={"snippet": snippet})
        for session, snippet in rows
    ]


@router.post("", response_model=SessionSummary, status_code=201)
def create_session(db: DBSession = Depends(get_db)):
    return SessionService(db).create()


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: str, db: DBSession = Depends(get_db)):
    session = SessionService(db).get(session_id)
    if session is None:
        raise _not_found()
    return session


@router.patch("/{session_id}", response_model=SessionSummary)
def update_session(
    session_id: str, body: SessionUpdate, db: DBSession = Depends(get_db)
):
    session = SessionService(db).update(
        session_id, title=body.title, pinned=body.pinned, archived=body.archived
    )
    if session is None:
        raise _not_found()
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, db: DBSession = Depends(get_db)) -> Response:
    # The share token lives on the session row, so deleting it also revokes any public link.
    if not SessionService(db).delete(session_id):
        raise _not_found()
    return Response(status_code=204)


@router.put("/{session_id}/turns/{turn_id}/feedback", response_model=FeedbackOut)
def set_feedback(
    session_id: str, turn_id: str, body: FeedbackIn, db: DBSession = Depends(get_db)
):
    if not SessionService(db).set_feedback(session_id, turn_id, body.rating):
        raise HTTPException(status_code=404, detail="Message not found.")
    return FeedbackOut(turn_id=turn_id, rating=body.rating)


@router.get("/{session_id}/share", response_model=ShareState)
def get_share(session_id: str, db: DBSession = Depends(get_db)):
    session = SessionService(db).get(session_id)
    if session is None:
        raise _not_found()
    return _share_state(session)


@router.post(
    "/{session_id}/share",
    response_model=ShareState,
    dependencies=[Depends(share_admin_limiter.dependency())],
)
def enable_share(
    session_id: str, body: Optional[ShareRequest] = None, db: DBSession = Depends(get_db)
):
    session = SessionService(db).enable_share(session_id, rotate=bool(body and body.rotate))
    if session is None:
        raise _not_found()
    return _share_state(session)


@router.delete("/{session_id}/share", status_code=204)
def revoke_share(session_id: str, db: DBSession = Depends(get_db)) -> Response:
    if not SessionService(db).revoke_share(session_id):
        raise _not_found()
    return Response(status_code=204)


@shared_router.get(
    "/{token}",
    response_model=SharedConversation,
    dependencies=[Depends(shared_limiter.dependency())],
)
def get_shared(token: str, response: Response, db: DBSession = Depends(get_db)):
    session = SessionService(db).get_shared(token)
    # One response for unknown and revoked tokens, so a token cannot be probed.
    if session is None:
        raise HTTPException(status_code=404, detail="This link is not available.")
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["Referrer-Policy"] = "no-referrer"
    return SharedConversation(
        title=session.title or "Untitled chat",
        shared_at=session.shared_at,
        turns=[
            {
                "user_message": t.user_message,
                "model_response": t.model_response,
                "created_at": t.created_at,
            }
            for t in session.turns
        ],
    )
