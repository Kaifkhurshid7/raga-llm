# Product Requirements Document (PRD)
## RAGA — Raga-Aware Generative Assistant

**Status:** Draft v1.0
**Owner:** Your Name
**Last updated:** 2026-10-13

---

## 1. Problem Statement

General-purpose LLMs (e.g., Llama 3.1 8B Instruct) answer questions about Hindustani classical music with the same fluent confidence they bring to well-represented topics — including when they are factually wrong. Facts like a raga's *vadi* (dominant note), *samvadi*, *thaat* (parent scale), or *aroha/avaroha* are precise and verifiable, but thinly represented in web-scale pretraining data. When asked about a raga it hasn't reliably learned, the model does not say "I don't know" — it fabricates a plausible, well-formed, **wrong** answer.

This is dangerous specifically because of the fluency: a music student with no way to independently verify the answer has no signal that anything is wrong.

## 2. Goals

| # | Goal |
|---|------|
| G1 | Measure how often the base model fabricates vs. correctly refuses on out-of-domain/unanswerable musicological questions |
| G2 | Reduce the fabrication rate via LoRA fine-tuning on a small, verified instruction dataset |
| G3 | Ensure the fix does not come at the cost of over-refusal (refusing genuinely answerable questions) |
| G4 | Ship a working chat application (RAGA) that demonstrates the model's behavior end-to-end |
| G5 | Produce a reusable dataset-construction methodology that generalizes to other low-resource domains |

## 3. Non-Goals

- NOT building a general-purpose music chatbot covering Carnatic music, Western theory, or audio analysis.
- NOT training from scratch — this is parameter-efficient fine-tuning (LoRA) on top of a frozen pretrained base model.
- NOT building multi-user auth, billing, or production-scale infrastructure — this is a research/demonstration artifact.
- NOT claiming the dataset is an exhaustive account of the raga system — it is scoped to one verified reference (Bor & Rao, *The Raga Guide*) plus targeted extensions.

## 4. Target Users / Personas

| Persona | Need |
|---|---|
| **Music student (primary)** | Wants quick, trustworthy answers about ragas while practicing/learning; needs the system to say "I'm not sure" rather than invent facts |
| **Evaluator / faculty (secondary)** | Needs to see measured evidence (not claims) that fine-tuning changed model behavior, with reproducible baselines |
| **Future researcher (secondary)** | Wants the dataset pipeline and evaluation harness to be reusable for a different low-resource domain |

## 5. User Stories

1. *As a student*, I can type a question about a raga and get an answer, or a clear statement that the system isn't sure, instead of a confident guess.
2. *As a student*, I can ask about a raga that doesn't exist and have the system tell me so, rather than inventing details for it.
3. *As an evaluator*, I can see the system's fabrication rate and over-refusal rate side by side, so I can tell whether "improvement" is real or just the model refusing everything.
4. *As a researcher*, I can re-run the dataset validation and contamination-check scripts on new data and trust that unverified content is blocked automatically.
5. *As a developer*, I can swap the serving model (base vs. LoRA-adapted vs. RAG-augmented) without changing the frontend or backend.

## 6. Functional Requirements

| ID | Requirement |
|---|---|
| FR1 | Chat interface accepts a free-text question and returns a generated answer |
| FR2 | Backend persists conversation history per session in PostgreSQL |
| FR3 | Inference service loads the base model + (optionally) a LoRA adapter, and serves generations under a fixed, logged decoding configuration |
| FR4 | Inference service supports a RAG mode: retrieve top-k passages from a verified corpus and condition generation on them |
| FR5 | Dataset pipeline generates instruction/output pairs from structured CSV ground truth across 10 categories, including a dedicated out-of-domain/refusal category |
| FR6 | Validation script blocks any record marked `UNVERIFIED` from reaching the training split |
| FR7 | Contamination-check script prevents evaluation-probe questions from leaking into the training split |
| FR8 | Evaluation harness computes fabrication rate (hallucination probe) and over-refusal rate (near-miss probe) together, for every serving condition |

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR1 | Baseline inference must be reproducible: identical input → byte-identical output under greedy decoding |
| NFR2 | Inference service must run within 25.3 GB VRAM at float16 for the 8B base model + adapter |
| NFR3 | Application backend/frontend must run on an 8 GB RAM laptop without requiring GPU access |
| NFR4 | All settings used for a generation (decoding config, model/adapter version) must be logged alongside the output for auditability |
| NFR5 | No fabricated page-level citations may appear in model training text (reserved for the retrieval corpus only) |

## 8. Success Metrics

| Metric | Definition | Target |
|---|---|---|
| Fabrication rate | % of hallucination-probe questions answered with a confident but false fact | Lower than baseline, measured not assumed |
| Over-refusal rate | % of near-miss-probe (genuinely answerable) questions incorrectly declined | Must not rise materially relative to baseline |
| Reproducibility | 3 repeated greedy-decoding runs on the same input | 100% identical output |
| Dataset integrity | % of generated records passing `validate.py` with zero issues | 100% before any record enters training |

## 9. Release Plan (Scope per Milestone)

| Milestone | Scope | Status |
|---|---|---|
| M1 — Baseline & decoding study | Reproducible baseline, decoding-parameter sweep | ✅ Done |
| M2 — Dataset pipeline | Structured ground truth, generation, validation, contamination check, entity research | ✅ Done |
| M3 — LoRA fine-tuning | Train adapter on verified split | 🔜 Not started |
| M4 — Four-condition evaluation | Baseline / few-shot / RAG / fine-tuned, fabrication + over-refusal rate | 🔜 Not started |
| M5 — RAGA application | Frontend, backend, inference service, Docker wiring | 🟡 In progress |

## 10. Open Risks

See `docs/ARCHITECTURE.md` §7 and `docs/WORKFLOW.md` §5 for technical risks and mitigations.
