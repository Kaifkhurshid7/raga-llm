"""
/generate router (layer: interface/API for this service).
"""
from fastapi import APIRouter, HTTPException

from app.core.decoding_config import BASELINE_CONFIG
from app.core.model_loader import get_model
from app.core.generator import generate as run_generation
from app.core.few_shot import with_few_shot
from app.core.retriever import get_retriever
from app.models.schemas import GenerateRequest, GenerateResponse

router = APIRouter(tags=["generate"])


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest):
    loaded = get_model()
    messages = list(req.history) + [{"role": "user", "content": req.message}]

    if req.serving_condition == "few_shot":
        messages = with_few_shot(messages)

    elif req.serving_condition == "rag":
        try:
            passages = get_retriever().retrieve(req.message)
            context = "\n".join(passages)
            messages[-1]["content"] = (
                f"Context:\n{context}\n\nQuestion: {req.message}"
            )
        except NotImplementedError as e:
            raise HTTPException(status_code=501, detail=str(e))

    elif req.serving_condition == "finetuned" and "lora" not in loaded.model_version:
        raise HTTPException(
            status_code=409,
            detail=(
                "serving_condition='finetuned' requested but no LoRA adapter is "
                "loaded (LORA_ADAPTER_PATH not set). Fine-tuning has not been run "
                "yet -- see docs/PRD.md milestone M3."
            ),
        )

    result = run_generation(loaded, messages, BASELINE_CONFIG)

    return GenerateResponse(
        text=result["text"],
        model_version=loaded.model_version,
        decoding_config=BASELINE_CONFIG.as_dict(),
        prompt_tokens=result["prompt_tokens"],
        output_tokens=result["output_tokens"],
    )
