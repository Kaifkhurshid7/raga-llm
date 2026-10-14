# RAGA — End-to-End Workflows

## 1. Dataset Construction Workflow

```
[ Primary source: Bor & Rao, "The Raga Guide" ]
                │  manual sourcing + cross-check
                ▼
[ Structured CSV ground truth ]  dataset/structured/{ragas,concepts,taals}.csv
   - one row per entity
   - fields: fact, source, contested(bool), verification_status
                │  dataset/scripts/generate.py
                ▼
[ Generated instruction/output pairs ]  dataset/generated/*.jsonl
   - 10 categories incl. out_of_domain (calibrated refusal)
   - ~15 angle variations per verified entity
                │  dataset/scripts/validate.py
                ▼
[ Validation gate ]
   - swara notation, banned transliterations, length ranges,
     duplicate check, no fabricated citations
   - BLOCKS any UNVERIFIED record from proceeding
                │  dataset/scripts/contamination_check.py
                ▼
[ Contamination check ]
   - ensures no overlap with the eval probes (finetuning/eval/)
                │  dataset/scripts/split.py (stratified by fact_group)
                ▼
[ train / val / test splits ]  → ready for finetuning/
```

## 2. LoRA Fine-Tuning Workflow

```
[ train split ] + [ base model: Llama 3.1 8B Instruct ]
                │
                ▼
[ finetuning/train_lora.py ]
   - freeze base model weights
   - attach LoRA adapters (attention projections)
   - train only adapter weights on train split
   - validate on val split each epoch
                │
                ▼
[ LoRA adapter artifact ]  (small, versioned, loadable on top of frozen base)
                │
                ▼
[ inference-service loads adapter ] ── served under identical decoding
                                        config as the recorded baseline
```

## 3. Evaluation Workflow (Four Conditions)

```
            ┌──────────────┐
            │ eval probes   │  finetuning/eval/hallucination_probe.jsonl
            │ (2, paired)   │  finetuning/eval/near_miss_probe.jsonl
            └───────┬──────┘
                    │  run against each condition, same decoding config
      ┌─────────────┼─────────────┬──────────────┐
      ▼             ▼             ▼              ▼
  [Baseline]    [Few-shot]      [RAG]       [Fine-tuned]
  zero-shot,    + 2 fixed       + retrieved  + LoRA adapter
  greedy        examples        passages     loaded
      │             │             │              │
      └─────────────┴─────┬───────┴──────────────┘
                           ▼
          [ fabrication_rate, over_refusal_rate ]
                per condition, reported together
```

## 4. User Chat Workflow (Runtime)

```
User types question in RAGA frontend
        │
        ▼
POST /api/chat {session_id, message}   (backend/app/api/)
        │
        ▼
ConversationService:
  - load history from Postgres
  - build prompt (system + history + message)
        │
        ▼
InferenceClient.generate(prompt, decoding_config)
        │  internal REST call
        ▼
inference-service /generate
  - run model (base | base+LoRA | base+RAG)
  - return {text, prompt_tokens, output_tokens, model_version}
        │
        ▼
ConversationService persists turn + full metadata → Postgres
        │
        ▼
Response returned to frontend, rendered in chat UI
```

## 5. Current Status vs. Remaining Work

| Workflow stage | Status |
|---|---|
| Dataset construction workflow (§1) | ✅ Pipeline built, validated, entity research complete (125 ragas, 34 multi-thaat) |
| Baseline + decoding-parameter characterization | ✅ Done, reproducible |
| LoRA fine-tuning workflow (§2) | 🔜 Designed, not yet executed |
| Four-condition evaluation workflow (§3) | 🔜 Designed, not yet executed (needs §2 complete + RAG corpus) |
| User chat runtime workflow (§4) | 🟡 Backend/frontend/DB scaffolded; inference-service currently serves baseline only |

## 6. Known Risks in This Workflow

- **Risk:** Dataset volume (~10–12k) is small relative to typical fine-tuning corpora.
  **Mitigation:** Low LoRA rank + verified-only data is a deliberate trade-off favoring correctness over scale (see PRD §3, Non-Goals).
- **Risk:** RAG corpus and training data could drift out of sync if updated independently.
  **Mitigation:** Both are built from the same `dataset/structured/` ground truth; the RAG corpus is generated from the same verified rows, not a separate source.
- **Risk:** Evaluation probe leakage into training data.
  **Mitigation:** `contamination_check.py` runs as a hard gate before any split is finalized (§1).
