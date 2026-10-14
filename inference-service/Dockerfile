FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
# Note: this installs CPU-only torch by default on a slim image; for the
# real GPU host, install a CUDA-matched torch build per
# https://pytorch.org/get-started/locally/ before the rest of requirements.
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
