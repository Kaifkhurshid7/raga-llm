# RAGA Workflows

| | |
|---|---|
| Document | End-to-end workflows |
| Status | Draft v1.0 |
| Related | [PRD](PRD.md), [Architecture](ARCHITECTURE.md), [Dataset conventions](../dataset/docs/CONVENTIONS.md) |

## 1. Dataset Construction

```mermaid
flowchart TD
    SRC[Primary source<br/>Bor and Rao, The Raga Guide] -->|manual sourcing and cross-check| CSV[Structured CSV ground truth<br/>dataset/structured/]
    CSV -->|generate.py| GEN[Instruction/output pairs<br/>dataset/generated/*.jsonl]
    GEN -->|validate.py --strict| VAL{Validation gate}
    VAL -->|pass| CONT[contamination_check.py]
    VAL -->|any UNVERIFIED or rule violation| FAIL[Blocked]
    CONT -->|no overlap with eval probes| SPLIT[split.py<br/>stratified by fact_group]
    CONT -->|overlap found| FAIL
    SPLIT --> OUT[train / val / test<br/>dataset/splits/]
```

| Stage | Input | Output | Gate |
|---|---|---|---|
| Ground truth | Primary source | `ragas.csv`, `concepts.csv`, `taals.csv` | One row per entity with fact, source, `contested`, `verification_status` |
| Generation | Verified rows | JSONL per category | Only `VERIFIED` rows are expanded (except the out-of-domain category) |
| Validation | Generated JSONL | Pass or fail | Swara notation, banned transliterations, length ranges, duplicates, fabricated citations, `UNVERIFIED` records |
| Contamination check | Generated JSONL, eval probes | Pass or fail | No evaluation probe question appears in training data |
| Split | Validated JSONL | Train, validation, test | Stratified by `fact_group` so related facts do not straddle splits |

The dataset covers ten categories, including `out_of_domain`, which teaches calibrated refusal.

## 2. LoRA Fine-Tuning

```mermaid
flowchart TD
    TRAIN[Train split] --> TL[finetuning/train_lora.py]
    BASE[Base model<br/>Llama 3.1 8B Instruct] --> TL
    CFG[configs/lora_config.yaml] --> TL
    TL --> FREEZE[Freeze base weights]
    FREEZE --> ATTACH[Attach LoRA adapters<br/>q, k, v, o projections]
    ATTACH --> FIT[Train adapter weights]
    VAL[Validation split] -.->|evaluate periodically| FIT
    FIT --> ART[LoRA adapter artifact<br/>adapters/raga-lora-v1]
    ART -->|LORA_ADAPTER_PATH| SERVE[Inference service<br/>same decoding config as baseline]
```

Initial hyperparameters (starting points for a small sweep on the validation split, not final values):

| Parameter | Value |
|---|---|
| Rank `r` / alpha / dropout | 16 / 32 / 0.05 |
| Target modules | `q_proj`, `k_proj`, `v_proj`, `o_proj` |
| Learning rate | 2e-4 |
| Epochs | 3 |
| Effective batch size | 16 (4 per device, 4 accumulation steps) |
| Precision | float16; 4-bit QLoRA fallback if VRAM is insufficient |

## 3. Evaluation (Four Conditions)

```mermaid
flowchart TD
    P1[hallucination_probe.jsonl] --> RUN[run_eval.py<br/>same decoding config]
    P2[near_miss_probe.jsonl] --> RUN
    RUN --> B[Baseline<br/>zero-shot, greedy]
    RUN --> F[Few-shot<br/>two fixed examples]
    RUN --> R[RAG<br/>retrieved passages]
    RUN --> T[Fine-tuned<br/>LoRA adapter loaded]
    B --> M[Fabrication rate<br/>and over-refusal rate]
    F --> M
    R --> M
    T --> M
```

| Probe | Question type | Metric |
|---|---|---|
| Hallucination probe | Unanswerable or non-existent entities | Fabrication rate (confident answer instead of refusal) |
| Near-miss probe | Answerable questions close to refusal territory | Over-refusal rate (incorrect decline) |

The two rates are always reported together. A drop in fabrication that comes with a rise in over-refusal is not an improvement.

## 4. Runtime Chat

```mermaid
flowchart TD
    A[User submits question] --> B[POST /api/chat]
    B --> C[ConversationService<br/>load history, build prompt]
    C --> D[InferenceClient.generate]
    D -->|internal REST| E[Inference service /generate<br/>base, LoRA, few-shot, or RAG]
    E --> F[text, token counts,<br/>model_version, decoding_config]
    F --> G[Persist turn and metadata<br/>PostgreSQL]
    G --> H[Response rendered in chat UI]
```

A sequence-level view is in [ARCHITECTURE.md](ARCHITECTURE.md), section 3.

## 5. Status

| Workflow | Status |
|---|---|
| Dataset construction (section 1) | Pipeline built and validated; entity research complete (125 ragas, 34 multi-thaat) |
| Baseline and decoding characterization | Complete and reproducible |
| LoRA fine-tuning (section 2) | Designed, not yet executed |
| Four-condition evaluation (section 3) | Harness ready; fine-tuned and RAG conditions require section 2 and a retrieval corpus |
| Runtime chat (section 4) | Application scaffolded; inference service currently serves the baseline only |

## 6. Workflow Risks

| Risk | Mitigation |
|---|---|
| Dataset volume (roughly 10,000 to 12,000) is small relative to typical fine-tuning corpora | Low LoRA rank and verified-only data, a deliberate trade of scale for correctness (see PRD non-goals) |
| RAG corpus and training data drift out of sync | Both are generated from the same `dataset/structured/` verified rows |
| Evaluation probe leakage into training data | `contamination_check.py` is a hard gate before any split is finalized |
