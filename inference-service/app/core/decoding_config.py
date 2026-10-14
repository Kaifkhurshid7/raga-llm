"""
Decoding configuration (layer: domain/config), matching the
decoding-parameter study in docs/ (see dissertation Chapter 3, Section
3.2). This is the SINGLE source of truth for decoding settings --
nothing in this service chooses sampling parameters ad hoc inline.

Held constant across baseline and fine-tuned evaluation (so that any
measured difference is attributable to the model/adapter, not to a
decoding-config mismatch):
"""
from dataclasses import dataclass, asdict


@dataclass(frozen=True)
class DecodingConfig:
    do_sample: bool = False       # greedy -> reproducible baseline
    temperature: float = 1.0      # ignored when do_sample=False (see dissertation Ch.3)
    top_p: float = 1.0            # ignored when do_sample=False
    top_k: int = 50               # ignored when do_sample=False
    repetition_penalty: float = 1.1
    max_new_tokens: int = 220
    seed: int = 42

    def as_dict(self) -> dict:
        return asdict(self)


# Per-category max_new_tokens, mirroring dataset/docs length ranges --
# a single global cap either truncates long answers or wastes compute
# on short ones (dissertation Ch.3, "Maximum output tokens").
CATEGORY_MAX_TOKENS = {
    "raga_facts": 220,
    "aroha_avaroha": 180,
    "vadi_samvadi": 200,
    "comparison": 300,
    "terminology": 220,
    "taal": 220,
    "beginner": 240,
    "advanced": 300,
    "out_of_domain": 200,
    "grounded": 220,
}

BASELINE_CONFIG = DecodingConfig()
