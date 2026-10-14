#!/usr/bin/env python3
"""
Stratified train/val/test split -- stratified by `fact_group`, NOT by
individual record. Splitting by individual example would let different
phrasings of the SAME underlying fact land on both sides of the split,
letting the model memorize an answer pattern instead of generalizing
it (see dissertation Ch.3, Section 3.3.2).

Only VERIFIED records are included in the splits by default.
"""
import json
import os
import random
import argparse
from collections import defaultdict

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(HERE, "generated")
OUT = os.path.join(HERE, "splits")

SEED = 42
RATIOS = {"train": 0.8, "val": 0.1, "test": 0.1}


def load_all_records():
    records = []
    for fname in sorted(os.listdir(GEN)):
        if fname.endswith(".jsonl"):
            with open(os.path.join(GEN, fname), encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        records.append(json.loads(line))
    return records


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--include-unverified", action="store_true",
                     help="include UNVERIFIED records (NOT recommended for training)")
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    records = load_all_records()

    if not args.include_unverified:
        before = len(records)
        records = [r for r in records if r["verification_status"] == "VERIFIED"]
        print(f"Dropped {before - len(records)} UNVERIFIED records "
              f"(use --include-unverified to keep them, not recommended).")

    by_group = defaultdict(list)
    for r in records:
        by_group[r["fact_group"]].append(r)

    groups = list(by_group.keys())
    random.Random(SEED).shuffle(groups)

    n = len(groups)
    n_train = int(n * RATIOS["train"])
    n_val = int(n * RATIOS["val"])

    split_groups = {
        "train": groups[:n_train],
        "val": groups[n_train:n_train + n_val],
        "test": groups[n_train + n_val:],
    }

    for split_name, group_list in split_groups.items():
        out_records = [r for g in group_list for r in by_group[g]]
        path = os.path.join(OUT, f"{split_name}.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for r in out_records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{split_name}: {len(group_list)} fact_groups, {len(out_records)} records -> {path}")


if __name__ == "__main__":
    main()
