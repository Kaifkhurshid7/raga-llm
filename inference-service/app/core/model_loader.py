"""
Model loader (layer: domain/infrastructure boundary to the model).

Loads the frozen base model once at startup, and optionally layers a
LoRA adapter on top. This is the ONLY file in the whole project that
imports `transformers`/`peft` model classes directly -- everything
above it (the API layer, the backend, the frontend) talks to this
through the /generate endpoint, never through a Python import.
"""
import os
from functools import lru_cache

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

# NousResearch mirror used pending Meta's gated-repo approval for the
# official meta-llama/Llama-3.1-8B-Instruct weights (identical weights;
# see dissertation Ch.3 and Ch.5 future work -- re-point once approved).
BASE_MODEL_ID = os.getenv("BASE_MODEL_ID", "NousResearch/Meta-Llama-3.1-8B-Instruct")
LORA_ADAPTER_PATH = os.getenv("LORA_ADAPTER_PATH", "")  # empty => base model only


class LoadedModel:
    def __init__(self):
        self.tokenizer = None
        self.model = None
        self.model_version = "uninitialized"

    def load(self):
        self.tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL_ID,
            torch_dtype=torch.float16,
            device_map="auto",
        )
        self.model_version = f"{BASE_MODEL_ID}-base"

        if LORA_ADAPTER_PATH:
            # Imported lazily so the base-only path (M1/M2, before
            # fine-tuning exists) never requires peft's training deps
            # to be importable at serve time.
            from peft import PeftModel

            self.model = PeftModel.from_pretrained(self.model, LORA_ADAPTER_PATH)
            self.model_version = f"{BASE_MODEL_ID}-lora:{os.path.basename(LORA_ADAPTER_PATH)}"

        self.model.eval()
        return self


@lru_cache(maxsize=1)
def get_model() -> LoadedModel:
    return LoadedModel().load()
