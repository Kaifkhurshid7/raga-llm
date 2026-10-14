"""
Application configuration (layer: cross-cutting / config).

Nothing in this file knows about FastAPI routes or the database driver
specifics -- it just centralizes environment-derived settings so the
rest of the app depends on `settings`, not on `os.environ` scattered
everywhere.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "RAGA Backend"
    database_url: str = "postgresql://raga:raga@db:5432/raga"
    inference_service_url: str = "http://inference-service:8001"
    inference_timeout_seconds: float = 60.0

    # Decoding config is owned by the inference service, but the backend
    # needs to know which *named* condition it is requesting, so the
    # choice is explicit end-to-end rather than implicit.
    default_serving_condition: str = "baseline"  # baseline | few_shot | rag | finetuned

    class Config:
        env_file = ".env"


settings = Settings()
