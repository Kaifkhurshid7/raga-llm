from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class GenerateRequest(BaseModel):
    history: List[Dict[str, str]]
    message: str
    serving_condition: str = "baseline"  # baseline | few_shot | rag | finetuned


class GenerateResponse(BaseModel):
    text: str
    model_version: str
    decoding_config: Dict[str, Any]
    prompt_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
