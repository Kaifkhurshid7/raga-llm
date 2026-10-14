#!/usr/bin/env python3
"""
Reproducible baseline inference: runs a fixed probe of questions under
greedy decoding (do_sample=False, seed=42), three times each, and
verifies byte-identical output across runs -- the evidentiary basis
for the reproducibility claim in the dissertation (Ch.4, Section 4.2.1).

Usage:
    python baseline_inference.py --model NousResearch/Meta-Llama-3.1-8B-Instruct
"""
import argparse
import json

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

PROBE_QUESTIONS = [
    {"id": "p1", "category": "vadi_samvadi", "text": "What is the vadi of Raag Yaman?"},
    {"id": "p2", "category": "vadi_samvadi", "text": "What are the vadi and samvadi of Raag Yaman?"},
    {"id": "p3", "category": "aroha_avaroha", "text": "What is the aroha and avaroha of Raag Bhairav?"},
    {"id": "p4", "category": "terminology", "text": "What is meend?"},
    {"id": "p5", "category": "terminology", "text": "What is the difference between meend and gamak?"},
    {"id": "p6", "category": "beginner", "text": "Explain Raag Bhairav to a beginner student."},
    {"id": "p7", "category": "advanced", "text": "Describe the characteristic phrases of Raag Bhairav for an advanced student."},
]

SYSTEM_PROMPT = (
    "You are RAGA, an assistant for Hindustani classical music. "
    "If you are not confident a fact is correct, say so plainly rather than guessing."
)


def generate_once(model, tokenizer, question: str, max_new_tokens: int, seed: int) -> dict:
    torch.manual_seed(seed)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]
    inputs = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, return_tensors="pt", return_dict=True
    ).to(model.device)
    input_len = inputs["input_ids"].shape[1]

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,  # greedy -- the baseline must be reproducible
        )

    text = tokenizer.decode(output_ids[0][input_len:], skip_special_tokens=True).strip()
    return {
        "text": text,
        "prompt_tokens": input_len,
        "output_tokens": output_ids.shape[1] - input_len,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="NousResearch/Meta-Llama-3.1-8B-Instruct")
    ap.add_argument("--max-new-tokens", type=int, default=220)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--out", default="baseline_results.json")
    args = ap.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(
        args.model, torch_dtype=torch.float16, device_map="auto"
    )
    model.eval()

    results = {
        "model": args.model,
        "decoding": {"do_sample": False, "seed": args.seed, "max_new_tokens": args.max_new_tokens},
        "questions": [],
    }

    for q in PROBE_QUESTIONS:
        run_outputs = [generate_once(model, tokenizer, q["text"], args.max_new_tokens, args.seed)
                       for _ in range(args.runs)]
        texts = [r["text"] for r in run_outputs]
        reproducible = len(set(texts)) == 1
        print(f"[{q['id']}] reproducible across {args.runs} runs: {reproducible}")

        results["questions"].append({
            **q,
            "runs": run_outputs,
            "reproducible": reproducible,
        })

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Results written to {args.out}")


if __name__ == "__main__":
    main()
