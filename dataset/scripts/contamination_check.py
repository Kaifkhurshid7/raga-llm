#!/usr/bin/env python3
"""
Verify that no training instruction leaks into the evaluation probes
(finetuning/eval/hallucination_probe.jsonl, near_miss_probe.jsonl).

A leaked evaluation example would invalidate the fabrication-rate /
over-refusal-rate measurement, since the model could have memorized
the exact answer during training rather than generalized to it.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(HERE, "generated")
EVAL_DIR = os.path.join(os.path.dirname(HERE), "finetuning", "eval")


def load_instructions(path):
    instructions = set()
    if not os.path.exists(path):
        return instructions
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            instructions.add(rec.get("instruction", rec.get("question", "")))
    return instructions


def main():
    train_instructions = set()
    if os.path.isdir(GEN):
        for fname in os.listdir(GEN):
            if fname.endswith(".jsonl"):
                train_instructions |= load_instructions(os.path.join(GEN, fname))

    probe_files = ["hallucination_probe.jsonl", "near_miss_probe.jsonl"]
    leaked = []
    for probe_file in probe_files:
        probe_path = os.path.join(EVAL_DIR, probe_file)
        probe_instructions = load_instructions(probe_path)
        overlap = train_instructions & probe_instructions
        if overlap:
            leaked.append((probe_file, overlap))

    if leaked:
        print("CONTAMINATION DETECTED:")
        for fname, overlap in leaked:
            print(f"  {fname}: {len(overlap)} overlapping instruction(s)")
            for instr in list(overlap)[:5]:
                print(f"    - {instr[:70]}")
        sys.exit(1)
    else:
        print(f"No contamination found. Checked {len(train_instructions)} training "
              f"instructions against {len(probe_files)} eval probe files.")


if __name__ == "__main__":
    main()
