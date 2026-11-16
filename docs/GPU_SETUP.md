# Setting up the GPU machine

Goal of this guide: run the real Llama model behind the RAGA chat app and confirm it answers,
**before any fine-tuning**. Training comes after (see the last section).

Assumes an NVIDIA GPU with about 25 GB VRAM and about 40 GB of free disk (16 GB model weights plus
training outputs). Commands are for Linux or macOS shells; Windows differences are noted.

## 1. Check the machine

```bash
nvidia-smi              # shows the GPU, and a driver version
python3 --version       # 3.10 to 3.12
node --version          # 20+ (only needed to run the web UI on this machine)
git --version
```

If `nvidia-smi` fails, install the NVIDIA driver first. Nothing below works without it.

## 2. Get the code

```bash
git clone -b KAIF-dev https://github.com/Kaifkhurshid7/raga-llm.git
cd raga-llm
```

The dataset is in the repository (`dataset/generated/`, `dataset/splits/`), so no separate copy is needed.

## 3. Inference service (the model)

```bash
cd inference-service
python3 -m venv .venv
source .venv/bin/activate                # Windows PowerShell: .\.venv\Scripts\Activate.ps1

# Install the CUDA build of torch FIRST. On Windows the default pip torch is CPU-only.
pip install torch==2.4.1 --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt

python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

The last line must print `True` and the GPU name. If it prints `False`, stop and fix that first.

Start the service:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

- The first start downloads about 16 GB from Hugging Face and loads it onto the GPU. This takes several
  minutes, and the service does not answer until it logs `Model ready`. That is expected.
- `LORA_ADAPTER_PATH` must stay empty for now, so you are testing the plain base model.
- Do not expose port 8001 to the internet. It has no authentication.

Test it directly (second terminal):

```bash
curl localhost:8001/health
curl -s localhost:8001/generate -H "Content-Type: application/json" \
  -d '{"history":[],"message":"What is the vadi of Raag Yaman?"}'
```

You should get JSON with `text`, `model_version` (ending in `-base`) and token counts. A first answer
takes a few seconds. If this works, the model is fine and everything after it is just wiring.

## 4. Backend

In a new terminal, from the repository root:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cat > .env <<'EOF'
DATABASE_URL=sqlite:///./raga_dev.db
USE_MOCK_INFERENCE=false
INFERENCE_SERVICE_URL=http://localhost:8001
EOF
uvicorn app.main:app --port 8000
```

`USE_MOCK_INFERENCE=false` is what makes the backend call the real model. Check
`curl localhost:8000/health`: it must show `"mock_inference": false`.

## 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, ask a question about a raga, and confirm that:
- the badge in the top bar shows the model name ending in `-base`, not `mock`;
- the answer is real model text, not `[mock response] ...`.

To use the UI from your own laptop instead of the GPU machine, run the frontend there and point it at
the backend: `API_PROXY_TARGET=http://<gpu-machine>:8000 npm run dev`. Only the backend port needs to
be reachable. Do not publish 8001.

## 6. Baseline evaluation (the "before" numbers)

```bash
cd finetuning/eval
python run_eval.py --inference-url http://localhost:8001 --condition baseline
```

It needs `httpx` (already installed with the backend requirements; `pip install httpx` otherwise).
Keep this output. Fine-tuning results only mean something compared with it.

Known issue: the refusal detector in `run_eval.py` looks for a fixed list of phrases. The refusals in
the new dataset use other wording ("I don't recognise", "There is no verified record of"), so a
fine-tuned model that refuses correctly could be scored as fabricating. Update `REFUSAL_MARKERS`
before trusting fine-tuned numbers.

## 7. Common problems

| Symptom | Cause and fix |
|---|---|
| `torch.cuda.is_available()` is `False` | CPU torch installed, or no driver. Reinstall torch with the `--index-url` line. |
| Out of memory while loading | Another process holds the GPU (`nvidia-smi`). Stop it, or use the 4-bit fallback. |
| UI says "Inference service timed out" | The model is still loading, or the answer took over 60 s. Wait for `Model ready`. |
| UI says "Inference service unavailable" | `INFERENCE_SERVICE_URL` is wrong. Outside Docker it must be `http://localhost:8001`. |
| Badge still says `mock` | `USE_MOCK_INFERENCE` is still true. Check `backend/.env` and restart the backend. |
| Hugging Face download fails | Check disk space and network. The default model needs no login. |

## 8. Before training (not part of this check)

- Stop the inference service first. Training and serving cannot share one GPU.
- `finetuning/train_lora.py` has never been run, and has known problems: Llama's tokenizer has no pad
  token, and it pads every example to 1024 tokens, which wastes about 10x compute on this dataset.
  Fix these before starting a long run.
- It also needs `pip install datasets pyyaml`.
- Run training inside `tmux` or `screen` so an SSH disconnect does not kill it.
