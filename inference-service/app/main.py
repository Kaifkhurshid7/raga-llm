import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.generate import router as generate_router
from app.core.model_loader import BASE_MODEL_ID, LORA_ADAPTER_PATH, get_model

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the model before accepting requests. Otherwise the first chat message triggers the
    # download and load (minutes), and the backend gives up after its 60 s timeout.
    # Set PRELOAD_MODEL=false to start instantly and load on the first request instead.
    if os.getenv("PRELOAD_MODEL", "true").lower() != "false":
        logger.info("Loading %s (first run downloads about 16 GB)...", BASE_MODEL_ID)
        loaded = get_model()
        logger.info("Model ready: %s", loaded.model_version)
    yield


app = FastAPI(title="RAGA Inference Service", version="0.1.0", lifespan=lifespan)
app.include_router(generate_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "base_model": BASE_MODEL_ID,
        "lora_adapter": LORA_ADAPTER_PATH or None,
    }
