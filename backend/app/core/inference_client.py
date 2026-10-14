"""Client for the inference service, plus a mock for GPU-free development."""
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings


@dataclass
class GenerationResult:
    text: str
    model_version: str
    decoding_config: Dict[str, Any]
    prompt_tokens: Optional[int] = None
    output_tokens: Optional[int] = None


class InferenceClient:
    def __init__(
        self, base_url: Optional[str] = None, timeout: Optional[float] = None
    ) -> None:
        self.base_url = base_url or settings.inference_service_url
        self.timeout = timeout or settings.inference_timeout_seconds

    async def generate(
        self,
        history: List[Dict[str, str]],
        message: str,
        serving_condition: str = "baseline",
    ) -> GenerationResult:
        payload = {
            "history": history,
            "message": message,
            "serving_condition": serving_condition,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()

        return GenerationResult(
            text=data["text"],
            model_version=data["model_version"],
            decoding_config=data["decoding_config"],
            prompt_tokens=data.get("prompt_tokens"),
            output_tokens=data.get("output_tokens"),
        )


class MockInferenceClient(InferenceClient):
    """Returns a canned response without contacting any service."""

    async def generate(
        self,
        history: List[Dict[str, str]],
        message: str,
        serving_condition: str = "baseline",
    ) -> GenerationResult:
        return GenerationResult(
            text=f"[mock response] You asked: {message!r}",
            model_version="mock-0.0",
            decoding_config={"mock": True},
            prompt_tokens=len(message.split()),
            output_tokens=0,
        )
