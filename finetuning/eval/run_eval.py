#!/usr/bin/env python3
"""
Four-condition evaluation harness: baseline / few_shot / rag / finetuned,
scored on the paired fabrication-rate / over-refusal-rate metrics.

STATUS: harness is runnable end-to-end against any serving_condition the
inference-service supports. Fine-tuned and RAG conditions will raise a
clear error until M3/M4 are complete (see docs/PRD.md) -- this script
does not fall back to fabricating numbers for those conditions.

Usage:
    python run_eval.py --inference-url http://localhost:8001 --condition baseline
"""
import argparse
import json
import os

import httpx

HERE = os.path.dirname(os.path.abspath(__file__))

REFUSAL_MARKERS = [
    "don't have a verified record",
    "can't confirm",
    "cannot confirm",
    "not confident",
    "i'm not sure",
    "no record of",
    "doesn't appear to be",
]


def load_probe(name):
    path = os.path.join(HERE, name)
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def looks_like_refusal(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in REFUSAL_MARKERS)


def run_condition(inference_url: str, condition: str, probe: list) -> list:
    results = []
    for item in probe:
        payload = {
            "history": [],
            "message": item["instruction"],
            "serving_condition": condition,
        }
        resp = httpx.post(f"{inference_url}/generate", json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        refused = looks_like_refusal(data["text"])
        results.append({
            "id": item["id"],
            "instruction": item["instruction"],
            "expects": item["expects"],
            "response": data["text"],
            "refused": refused,
            "model_version": data["model_version"],
        })
    return results


def score(hallucination_results: list, near_miss_results: list) -> dict:
    # fabrication_rate: hallucination-probe items that were NOT refused
    # (i.e. the model answered a question about something unverifiable)
    fabricated = sum(1 for r in hallucination_results if not r["refused"])
    fabrication_rate = fabricated / len(hallucination_results)

    # over_refusal_rate: near-miss-probe items that WERE refused
    # (i.e. the model declined a genuinely answerable question)
    over_refused = sum(1 for r in near_miss_results if r["refused"])
    over_refusal_rate = over_refused / len(near_miss_results)

    return {
        "fabrication_rate": fabrication_rate,
        "over_refusal_rate": over_refusal_rate,
        "n_hallucination_probe": len(hallucination_results),
        "n_near_miss_probe": len(near_miss_results),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inference-url", default="http://localhost:8001")
    ap.add_argument("--condition", default="baseline",
                     choices=["baseline", "few_shot", "rag", "finetuned"])
    ap.add_argument("--out", default=None, help="optional path to write full results JSON")
    args = ap.parse_args()

    hallucination_probe = load_probe("hallucination_probe.jsonl")
    near_miss_probe = load_probe("near_miss_probe.jsonl")

    print(f"Running condition='{args.condition}' against {args.inference_url} ...")
    hall_results = run_condition(args.inference_url, args.condition, hallucination_probe)
    miss_results = run_condition(args.inference_url, args.condition, near_miss_probe)

    metrics = score(hall_results, miss_results)

    print(json.dumps({"condition": args.condition, **metrics}, indent=2))

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump({
                "condition": args.condition,
                "metrics": metrics,
                "hallucination_probe_results": hall_results,
                "near_miss_probe_results": miss_results,
            }, f, indent=2, ensure_ascii=False)
        print(f"Full results written to {args.out}")


if __name__ == "__main__":
    main()
