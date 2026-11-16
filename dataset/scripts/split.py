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

    # Stratified by category: shuffle and cut the fact_groups of each category separately, so every
    # category appears in train, val and test. A group never spans categories (validate.py checks this).
    groups_by_cat = defaultdict(list)
    for g, recs in by_group.items():
        groups_by_cat[recs[0]["category"]].append(g)

    split_groups = {"train": [], "val": [], "test": []}
    for cat in sorted(groups_by_cat):
        groups = sorted(groups_by_cat[cat])
        random.Random(f"{SEED}-{cat}").shuffle(groups)
        n = len(groups)
        # At least one group in val and test whenever the category has three or more groups.
        n_val = max(1, round(n * RATIOS["val"])) if n >= 3 else 0
        n_test = max(1, round(n * RATIOS["test"])) if n >= 3 else 0
        n_train = n - n_val - n_test
        split_groups["train"] += groups[:n_train]
        split_groups["val"] += groups[n_train:n_train + n_val]
        split_groups["test"] += groups[n_train + n_val:]

    for split_name, group_list in split_groups.items():
        out_records = [r for g in group_list for r in by_group[g]]
        path = os.path.join(OUT, f"{split_name}.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for r in out_records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{split_name}: {len(group_list)} fact_groups, {len(out_records)} records -> {path}")


if __name__ == "__main__":
    main()
