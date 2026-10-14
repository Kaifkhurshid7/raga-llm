# RAGA — Clean Architecture

## 1. Layering Principle

The system follows the **Clean Architecture** dependency rule: inner layers never import from outer layers. Dependencies point inward, toward domain logic; the model and the database are both treated as swappable *details*, not the center of the design.

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer                                           │
│  React + TypeScript + Vite + Tailwind (frontend/)              │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS / REST (JSON)
┌───────────────────────────▼─────────────────────────────────┐
│  Interface / API Layer                                        │
│  FastAPI routers — backend/app/api/                            │
│  (request validation via Pydantic schemas, auth stub, CORS)    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Application / Service Layer                                  │
│  backend/app/core/ — conversation service, orchestration       │
│  (talks to inference client + repository; no framework code)  │
└──────────────┬─────────────────────────────┬─────────────────┘
               │                             │
┌──────────────▼───────────────┐  ┌──────────▼──────────────────┐
│  Domain / Repository Layer     │  │  Inference Client (port)      │
│  backend/app/db/ — Postgres    │  │  backend/app/core/inference_   │
│  repository implementations    │  │  client.py (HTTP client to     │
│  (SQLAlchemy models, CRUD)      │  │  inference-service)            │
└─────────────────────────────┘  └──────────┬──────────────────┘
                                             │ internal REST call
                              ┌──────────────▼──────────────────┐
                              │  Inference Service (own process)  │
                              │  inference-service/app/           │
                              │  - loads base model (frozen)       │
                              │  - loads LoRA adapter (optional)   │
                              │  - decoding config (fixed/logged)  │
                              │  - RAG retriever (optional mode)   │
                              └─────────────────────────────────┘
```

## 2. Why Two Separate Services (Backend vs. Inference Service)

| Concern | Backend | Inference Service |
|---|---|---|
| Holds model weights | No | Yes |
| Needs GPU | No | Yes |
| Owns persistence (Postgres) | Yes | No |
| Can be restarted/swapped independently | Yes | Yes (swap base ↔ fine-tuned ↔ RAG without touching backend) |
| Runs on | 8 GB laptop | 25.3 GB VRAM GPU host |

This separation is what lets the two-hardware development model work: the application (backend + frontend + DB) is built and tested entirely on a laptop with no GPU, while the inference service is only stood up on the GPU host when model work begins. The backend talks to the inference service purely over HTTP, through a thin `InferenceClient` port — so from the backend's point of view, swapping the baseline model for the fine-tuned one is a config change, not a code change.

## 3. Request Flow (Chat Query)

1. **Frontend** sends `POST /api/chat` with `{session_id, message}`.
2. **API layer** validates the payload (Pydantic schema), resolves `session_id`.
3. **Service layer** (`ConversationService`) loads prior turns from the repository, builds the prompt (system prompt + history + new message), and calls `InferenceClient.generate(...)`.
4. **InferenceClient** makes an internal REST call to the inference service's `/generate` endpoint, passing the prompt and the **fixed decoding config** (never chosen ad hoc per request).
5. **Inference service** runs the model (base, or base+LoRA adapter, or base+RAG context depending on configured mode), returns `{text, prompt_tokens, output_tokens, model_version, decoding_config}`.
6. **Service layer** persists the turn (user message + model response + full metadata) via the repository.
7. **API layer** returns the response to the frontend.

Every generation's full metadata (which model/adapter version served it, which decoding config was used) is persisted — this is what makes later evaluation auditable rather than just "trust the log."

## 4. Domain Boundaries

- **Backend** knows nothing about model internals — it only knows "call generate(prompt, config) and get text back." This means the backend code does not change at all between M1 (baseline-only) and M3 (fine-tuned model available).
- **Inference service** knows nothing about conversations, sessions, or Postgres — it is a pure model-serving boundary, reusable by the evaluation harness (`finetuning/eval/`) directly, without going through the backend or frontend at all.
- **Dataset pipeline** (`dataset/`) and **fine-tuning** (`finetuning/`) are entirely offline, batch processes — they do not run inside either service at request time. Their only contract with the serving system is the LoRA adapter artifact and the retrieval corpus they produce.

## 5. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React, TypeScript, Vite, Tailwind | Fast dev loop, no GPU dependency, standard SPA stack |
| Backend API | FastAPI (Python) | Async, auto OpenAPI schema, thin — matches a small well-defined endpoint surface better than Django's batteries-included stack |
| Inference service | FastAPI + Hugging Face `transformers` + `peft` | Same async framework as backend for consistency; `peft` is the LoRA loading/training library |
| Database | PostgreSQL | Relational, durable conversation history |
| Containerization | Docker + docker-compose | Reproducible across the two-hardware dev model |
| Base model | Llama 3.1 8B Instruct (NousResearch mirror, pending Meta gated-repo approval) | Open-weight, instruction-tuned, fits 25.3 GB VRAM at fp16 |
| Fine-tuning | LoRA via Hugging Face `peft` | Parameter-efficient; <1% of params trained; fits available VRAM |

## 6. Repository Structure

```
raga-project/
├── docs/                  # PRD, architecture, workflow (this folder)
├── backend/               # FastAPI app: API + service + persistence layers
│   └── app/
│       ├── api/           # routers (interface layer)
│       ├── core/          # services, inference client port, config
│       ├── models/        # SQLAlchemy ORM models
│       ├── schemas/       # Pydantic request/response schemas
│       └── db/            # session management, repository implementations
├── inference-service/     # FastAPI app serving the model
│   └── app/
│       ├── api/           # /generate, /health endpoints
│       ├── core/          # model loader, decoding config, RAG retriever
│       └── models/        # request/response schemas for this service
├── frontend/               # React + Vite + Tailwind chat UI
├── dataset/                # offline dataset construction pipeline
│   ├── structured/         # ragas.csv, concepts.csv, taals.csv (ground truth)
│   ├── generated/          # output JSONL per category
│   ├── scripts/            # generate.py, validate.py, split.py, contamination_check.py
│   └── docs/               # CONVENTIONS.md
├── finetuning/              # offline LoRA training + evaluation
│   ├── configs/            # LoRA hyperparameters
│   └── eval/                # fabrication-rate / over-refusal-rate probes + harness
├── infra/                   # docker-compose, env templates
└── docker-compose.yml
```

## 7. Technical Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Fine-tuning overfits on a ~10–12k example dataset | Low LoRA rank (regularizing by construction); held-out validation split; monitor eval loss |
| Fine-tuned model regresses on general ability outside the domain | Evaluate on a small general-instruction-following sanity probe, not just the music probes |
| RAG retrieval surfaces a contested/wrong passage | Retrieval corpus built only from the same verified sources as training data; contested facts explicitly flagged rather than presented as settled |
| Decoding config drifts between baseline and fine-tuned evaluation | Config is version-controlled (`finetuning/configs/`) and logged per-generation, never set ad hoc |
| GPU host unavailable mid-development | Backend/frontend developed and fully testable against a mocked `InferenceClient` with no GPU required |
