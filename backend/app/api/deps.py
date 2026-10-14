"""FastAPI dependency providers."""
from app.core.config import settings
from app.core.inference_client import InferenceClient, MockInferenceClient


def get_inference_client() -> InferenceClient:
    """Return the mock client when mock inference is enabled."""
    if settings.use_mock_inference:
        return MockInferenceClient()
    return InferenceClient()
