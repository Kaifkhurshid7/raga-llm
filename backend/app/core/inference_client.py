"""
InferenceClient (layer: application-layer *port*).

This is the single seam between the backend and the model-serving
process. The service layer depends only on this interface -- it never
imports `transformers`, never knows about GPUs, and never changes
between "baseline only" and "fine-tuned model available". Swapping
which model serves a request is a config change in the inference
service, not a code change here.
"""
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
    def __init__(self, base_url: str = None, timeout: float = None):
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
    """
    Used for backend/frontend development with no GPU and no inference
    service running at all -- exactly the "laptop-only" half of the
    two-hardware development model described in docs/ARCHITECTURE.md.
    """

    async def generate(self, history, message, serving_condition="baseline") -> GenerationResult:
        return GenerationResult(
            text=(
                "[mock response -- inference-service not connected] "
                f"You asked: {message!r}"
            ),
            model_version="mock-0.0",
            decoding_config={"do_sample": False, "note": "mock client, no real decoding"},
            prompt_tokens=len(message.split()),
            output_tokens=10,
        )
