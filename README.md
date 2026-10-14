# RAGA — Raga-Aware Generative Assistant

Reducing confident fabrication in a low-resource Hindustani classical music LLM, via LoRA fine-tuning of Llama 3.1 8B Instruct on a small, verified instruction dataset.

> **Project status:** Baseline establishment, decoding-parameter study, and the dataset construction pipeline are complete. LoRA fine-tuning and the four-condition comparative evaluation are designed but not yet executed. See `docs/PRD.md` §9 for the milestone-by-milestone status.

## Start here

1. `docs/PRD.md` — what this project is, for whom, and what "done" means
2. `docs/ARCHITECTURE.md` — clean-architecture layering, service boundaries, tech stack
3. `docs/WORKFLOW.md` — dataset construction, fine-tuning, evaluation, and runtime chat workflows

## Repository layout

```
raga-project/
├── docs/                  ← read this first
├── backend/               ← FastAPI app (API + persistence), no GPU needed
├── inference-service/     ← FastAPI app serving the model, needs GPU
├── frontend/               ← React + Vite + Tailwind chat UI
├── dataset/                ← offline dataset construction pipeline
├── finetuning/              ← offline LoRA training + evaluation harness
├── infra/                   ← env templates
└── docker-compose.yml
```

## Local development (two-hardware model)

**On your laptop (no GPU needed):**
```bash
cp infra/.env.example infra/.env
docker-compose up backend frontend db
```
This brings up the chat UI, API, and database. The backend talks to the inference service over HTTP — point `INFERENCE_SERVICE_URL` in `infra/.env` at wherever that service is running (local mock, or the GPU host).

**On the GPU host:**
```bash
cd inference-service
pip install -r requirements.txt --break-system-packages
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

**Dataset pipeline (either machine, CPU only):**
```bash
cd dataset
python scripts/generate.py
python scripts/validate.py --strict
python scripts/contamination_check.py
python scripts/split.py
```

**Fine-tuning (GPU host only):**
```bash
cd finetuning
python train_lora.py --config configs/lora_config.yaml
```

## License / Attribution

Base model: Meta Llama 3.1 8B Instruct (served via the `NousResearch` ungated mirror pending Meta gated-repo approval — see `docs/ARCHITECTURE.md` §5). Musicological ground truth sourced from Bor & Rao, *The Raga Guide* (full citation in the dissertation's `references.bib`).
# raga-llm
