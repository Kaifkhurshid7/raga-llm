import os
import tempfile

# Must be set before the app is imported: settings and the engine are built at import time.
_tmp = tempfile.mkdtemp(prefix="raga-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["USE_MOCK_INFERENCE"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import get_inference_client  # noqa: E402
from app.core.inference_client import GenerationResult, InferenceClient  # noqa: E402
from app.db.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


class RecordingClient(InferenceClient):
    """Answers deterministically and records the history it was given."""

    def __init__(self):
        self.histories = []

    async def generate(self, history, message, serving_condition="baseline"):
        self.histories.append(history)
        return GenerationResult(
            text=f"answer to: {message}",
            model_version="test-model",
            decoding_config={"test": True},
            prompt_tokens=1,
            output_tokens=1,
        )


class FailingClient(InferenceClient):
    def __init__(self, error: Exception):
        self.error = error

    async def generate(self, *args, **kwargs):
        raise self.error


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def recorder():
    rec = RecordingClient()
    app.dependency_overrides[get_inference_client] = lambda: rec
    return rec


@pytest.fixture
def use_failing_client():
    def _use(error: Exception):
        app.dependency_overrides[get_inference_client] = lambda: FailingClient(error)

    return _use
