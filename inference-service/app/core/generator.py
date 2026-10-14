"""
Generation logic (layer: domain/application for this service).

Encapsulates the exact apply_chat_template -> generate -> decode
sequence, including the fix documented in the dissertation for newer
`transformers` versions returning a dict (not a bare tensor) from
apply_chat_template.
"""
from typing import List, Dict

import torch

from app.core.decoding_config import DecodingConfig
from app.core.model_loader import LoadedModel


def generate(
    loaded: LoadedModel,
    messages: List[Dict[str, str]],
    config: DecodingConfig,
) -> dict:
    torch.manual_seed(config.seed)

    inputs = loaded.tokenizer.apply_chat_template(
        messages,
        add_generation_prompt=True,
        return_tensors="pt",
        return_dict=True,
    ).to(loaded.model.device)

    input_len = inputs["input_ids"].shape[1]

    gen_kwargs = dict(
        max_new_tokens=config.max_new_tokens,
        do_sample=config.do_sample,
        repetition_penalty=config.repetition_penalty,
    )
    if config.do_sample:
        gen_kwargs.update(
            temperature=config.temperature,
            top_p=config.top_p,
            top_k=config.top_k,
        )
    # NOTE: when do_sample=False, temperature/top_p/top_k are ignored by
    # `generate()` entirely -- they are deliberately omitted from
    # gen_kwargs above rather than passed-and-ignored, to avoid the
    # documentation trap called out in the dissertation (Ch.3 Section 3.2).

    with torch.no_grad():
        output_ids = loaded.model.generate(**inputs, **gen_kwargs)

    output_tokens = output_ids.shape[1] - input_len
    text = loaded.tokenizer.decode(
        output_ids[0][input_len:], skip_special_tokens=True
    )

    return {
        "text": text.strip(),
        "prompt_tokens": input_len,
        "output_tokens": output_tokens,
    }
