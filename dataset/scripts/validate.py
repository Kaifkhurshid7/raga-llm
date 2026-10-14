#!/usr/bin/env python3
"""
Validate generated dataset files against the frozen conventions
(dataset/docs/CONVENTIONS.md).

Checks:
  1. Swara notation is well-formed and uses the frozen convention
  2. No banned transliterations
  3. Answer length within category range
  4. No duplicate instructions (case-sensitive -- see CONVENTIONS.md)
  5. fact_group present and consistent
  6. Verification status -- blocks training on UNVERIFIED content
  7. No fabricated page-level citations in training text

Usage:
    python validate.py
    python validate.py --strict     # exit nonzero on any failure
"""
import json, os, re, sys, argparse
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(HERE, "generated")

VALID_SWARA_CHARS = set("SRGMPDNsrgmpdn' .,|-")

BANNED_TRANSLITERATIONS = {
    "aaroh": "aroha", "avroh": "avaroha", "vaadi": "vadi",
    "samvaadi": "samvadi", "matraa": "matra", "gharaanaa": "gharana",
    "M(tivra)": "M'", "Ma tivra": "M'", "svara": "swara",
    "thaath": "thaat", "taala": "taal",
}

CITATION_PATTERNS = [
    re.compile(r"\bp\.?\s?\d+", re.I),
    re.compile(r"\bpp\.?\s?\d+", re.I),
    re.compile(r"\bVol(ume)?\.?\s?\d+", re.I),
    re.compile(r"\(\s*\d{4}\s*[,)]"),
]

LENGTH_RANGES = {
    "raga_facts":     (40, 220),
    "aroha_avaroha":  (30, 180),
    "vadi_samvadi":   (40, 200),
    "comparison":     (80, 300),
    "terminology":    (30, 220),
    "taal":           (40, 220),
    "beginner":       (60, 240),
    "advanced":       (80, 300),
    "out_of_domain":  (40, 200),
    "grounded":       (40, 220),
}


def extract_swara_runs(text):
    return re.findall(r"(?<![A-Za-z])((?:[SRGMPDNsrgmpdn]'?[ ,]+){2,}[SRGMPDNsrgmpdn]'?)", text)


def check_notation(rec, issues):
    for run in extract_swara_runs(rec["output"]):
        bad = set(run) - VALID_SWARA_CHARS
        if bad:
            issues.append((rec["id"], "notation", f"invalid chars {bad} in '{run[:40]}'"))


def check_transliteration(rec, issues):
    text = rec["instruction"] + " " + rec["output"]
    for bad, good in BANNED_TRANSLITERATIONS.items():
        if bad in text:
            issues.append((rec["id"], "convention", f"'{bad}' should be '{good}'"))


def check_citations(rec, issues):
    for pat in CITATION_PATTERNS:
        m = pat.search(rec["output"])
        if m:
            issues.append((rec["id"], "CITATION",
                           f"page-level citation '{m.group()}' in training output"))


def check_length(rec, issues):
    lo, hi = LENGTH_RANGES.get(rec["category"], (30, 300))
    n = len(rec["output"].split())
    if n < lo:
        issues.append((rec["id"], "length", f"{n} words, below minimum {lo}"))
    elif n > hi:
        issues.append((rec["id"], "length", f"{n} words, above maximum {hi}"))


def check_fields(rec, issues):
    for field in ("id", "category", "subtype", "difficulty",
                  "instruction", "output", "fact_group", "verification_status"):
        if not rec.get(field) and field != "input":
            issues.append((rec["id"], "schema", f"missing or empty '{field}'"))


def check_placeholder(rec, issues):
    if "{" in rec["output"] or "}" in rec["output"]:
        issues.append((rec["id"], "template", "unrendered template placeholder in output"))
    if ".." in rec["output"] or "  " in rec["output"]:
        issues.append((rec["id"], "format", "double punctuation or double space"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()

    issues = []
    seen_instructions = defaultdict(list)
    fact_groups = defaultdict(set)
    status = Counter()
    per_cat = Counter()
    total = 0

    if not os.path.isdir(GEN) or not os.listdir(GEN):
        print(f"No generated files found in {GEN}. Run generate.py first.")
        sys.exit(1 if args.strict else 0)

    for fname in sorted(os.listdir(GEN)):
        if not fname.endswith(".jsonl"):
            continue
        with open(os.path.join(GEN, fname), encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                total += 1
                per_cat[rec["category"]] += 1
                status[rec["verification_status"]] += 1

                check_fields(rec, issues)
                check_notation(rec, issues)
                check_transliteration(rec, issues)
                check_citations(rec, issues)
                check_length(rec, issues)
                check_placeholder(rec, issues)

                # Case-SENSITIVE comparison -- see CONVENTIONS.md on why
                # .lower() here would wrongly conflate musicologically
                # distinct swara sequences (shuddha vs. komal).
                seen_instructions[rec["instruction"]].append(rec["id"])
                fact_groups[rec["fact_group"]].add(rec["category"])

    for instr, ids in seen_instructions.items():
        if len(ids) > 1:
            issues.append((", ".join(ids[:3]), "duplicate",
                           f"identical instruction: '{instr[:60]}'"))

    for fg, cats in fact_groups.items():
        if len(cats) > 1:
            issues.append((fg, "fact_group",
                           f"spans categories {cats} -- will break stratified split"))

    print(f"\n{'CATEGORY':<20}{'COUNT':>8}")
    print("-" * 28)
    for cat, n in sorted(per_cat.items()):
        print(f"{cat:<20}{n:>8}")
    print("-" * 28)
    print(f"{'TOTAL':<20}{total:>8}\n")

    by_type = Counter(t for _, t, _ in issues)
    if issues:
        print(f"{'ISSUE TYPE':<20}{'COUNT':>8}")
        print("-" * 28)
        for t, n in by_type.most_common():
            print(f"{t:<20}{n:>8}")
        print()
        print("First 15 issues:")
        for rid, t, msg in issues[:15]:
            print(f"  [{t}] {rid}: {msg}")
        if len(issues) > 15:
            print(f"  ... and {len(issues)-15} more")
    else:
        print("No issues found.")

    print(f"\n{'VERIFICATION':<20}{'COUNT':>8}")
    print("-" * 28)
    for s, n in status.most_common():
        print(f"{s:<20}{n:>8}")

    unverified = status.get("UNVERIFIED", 0)
    if unverified:
        print(f"\n  BLOCKED FOR TRAINING: {unverified} examples are UNVERIFIED.")
        print("  Expert verification is required before any of this reaches the model.")

    if args.strict and (issues or unverified):
        sys.exit(1)


if __name__ == "__main__":
    main()
