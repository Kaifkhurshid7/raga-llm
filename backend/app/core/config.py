"""Application settings, loaded from environment variables or `.env`."""
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "RAGA Backend"
    database_url: str = "postgresql://raga:raga@db:5432/raga"

    inference_service_url: str = "http://inference-service:8001"
    inference_timeout_seconds: float = 60.0
    use_mock_inference: bool = True

    # One of: baseline | few_shot | rag | finetuned
    default_serving_condition: str = "baseline"

    # Accepts a comma-separated string or a list.
    cors_origins: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


settings = Settings()
