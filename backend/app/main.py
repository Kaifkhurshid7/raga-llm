"""Application entrypoint."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.chat import router as chat_router
from app.api.sessions import router as sessions_router, shared_router
from app.core.config import settings
from app.core.session_service import SessionService
from app.db.migrations import upgrade_schema
from app.db.session import Base, SessionLocal, engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    upgrade_schema(engine)
    with SessionLocal() as db:
        SessionService(db).backfill_titles()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(sessions_router)
app.include_router(shared_router)


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception("Database error", exc_info=exc)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable."})


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {
        "status": "ok",
        "mock_inference": settings.use_mock_inference,
        "serving_condition": settings.default_serving_condition,
    }
