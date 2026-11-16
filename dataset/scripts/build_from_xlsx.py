#!/usr/bin/env python3
"""
Convert dataset/training-questions.xlsx (category, question, answer, angle_type) into the JSONL
schema the rest of the pipeline expects (dataset/generated/NN_<category>.jsonl).

The workbook has no entity column, so `fact_group` is derived from the text. It is what
`split.py` splits on, so every phrasing of one fact has to land in the same group:

    raga_facts, vadi_samvadi, ...  <category>_<Raga>
    comparison                     comparison_<RagaA>+<RagaB>   (sorted pair)
    taal (matra questions)         taal_<Taal>_m<matra>
    taal (other)                   taal_<Taal>
    terminology                    terminology_<term>
    out_of_domain                  out_of_domain_<invented name>
    grounded                       grounded_<hash of the passage>

Rows whose group cannot be worked out are not guessed: they are written to
dataset/unresolved.jsonl and left out, and the count is printed.

Usage (from dataset/):
    python scripts/build_from_xlsx.py [--xlsx training-questions.xlsx]
"""
import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict

import pandas as pd

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(HERE, "generated")

CATEGORIES = [
    "raga_facts", "aroha_avaroha", "vadi_samvadi", "comparison", "terminology",
    "taal", "beginner", "advanced", "out_of_domain", "grounded",
]
DIFFICULTY = {"beginner": "basic", "advanced": "advanced"}
TAALS = ["Teentaal", "Ektaal", "Jhaptaal"]
TERMS = ["gamak", "meend", "kan", "andolan", "jati", "badhat", "shruti", "samay", "thaat"]
# General-concept questions that name no raga: grouped by the first concept found, in this order.
CONCEPTS = [
    "samay", "prahar", "shruti", "meend", "andolan", "gamak", "badhat", "kan", "vakra", "samvadi",
    "vadi", "avaroha", "aroha", "theka", "vibhag", "matra", "khali", "sam", "tivra", "komal",
    "shuddha", "jati", "mandra|madhya|taar|saptak|octave", "audav|sampurna|shadav", "thaat",
    "taal", "swara", "tonic|sa", "raga|raag",
]
RAAG_WORD = r"\b[Rr]aa?g(?:a)?\b"
# Words that can follow "Raag" in a refusal question but are not part of the invented name.
GENERIC_CAPS = {"I", "Hindustani", "Bhatkhande", "Raag", "Raga", "Rag", "Can", "Please", "What", "Which"}


def norm(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", str(text).replace("\r\n", "\n")).strip()
    # A stray double full stop is a typo; a real ellipsis ("...") is left alone.
    return re.sub(r"(?<!\.)\.\.(?!\.)", ".", text)


def eval_probe_questions() -> set:
    """Questions used by the evaluation probes. They must never appear in training."""
    probes = set()
    eval_dir = os.path.join(os.path.dirname(HERE), "finetuning", "eval")
    if os.path.isdir(eval_dir):
        for name in os.listdir(eval_dir):
            if name.endswith(".jsonl"):
                with open(os.path.join(eval_dir, name), encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            rec = json.loads(line)
                            probes.add(rec.get("instruction", rec.get("question", "")))
    return probes


def known_ragas(df: pd.DataFrame) -> list:
    """Real ragas are the names that recur across the non-refusal categories."""
    pat = re.compile(RAAG_WORD + r"\s+((?:[A-Z][\w']*)(?:\s+[A-Z][\w']*)*)")
    counts = Counter()
    for q in df[df.category != "out_of_domain"].question:
        counts.update(pat.findall(q))
    names = [n for n, c in counts.items() if c >= 30]
    # "Raag Yaman Kalyan"-style over-captures never reach 30, so what is left is clean names.
    return sorted(names, key=lambda n: -len(n))


def find_ragas(text: str, names: list) -> list:
    """Known raga names in order of appearance, longest match first ('Ahir Bhairav' before 'Bhairav')."""
    found, taken = [], []
    for name in names:
        for m in re.finditer(r"(?<![A-Za-z])" + re.escape(name) + r"(?![A-Za-z])", text, re.I):
            if any(m.start() < e and m.end() > s for s, e in taken):
                continue
            taken.append((m.start(), m.end()))
            found.append((m.start(), name))
    return [n for _, n in sorted(found)]


def invented_name(question: str, answer: str, names: list):
    """The made-up raga/term/taal a refusal question is about."""
    m = re.search(RAAG_WORD + r"\s+([A-Z][\w']*(?:\s+[A-Z][\w']*)*)", question)
    if m:
        return m.group(1)
    for text in (question, answer):
        caps = [w for w in re.findall(r"\b[A-Z][a-z][\w']*", text) if w not in GENERIC_CAPS]
        # drop the sentence-initial word of the question ("Can", "Explain", ...)
        caps = [w for w in caps if not question.startswith(w + " ")] if text is question else caps
        caps = [w for w in caps if w not in names]
        if caps:
            return caps[0]
    return None


def concept_of(text: str):
    low = text.lower()
    for c in CONCEPTS:
        if re.search(r"(?<![a-z])(?:" + c + r")s?(?![a-z])", low):
            return c.split("|")[0]
    return None


def fact_group(row, names: list):
    cat, q, a = row.category, row.question, row.answer
    if cat == "grounded":
        passage = q.split("Question:")[0]
        return f"grounded_{hashlib.sha1(passage.encode('utf-8')).hexdigest()[:10]}"
    if cat == "out_of_domain":
        name = invented_name(q, a, names)
        return f"out_of_domain_{name}" if name else None
    if cat == "taal":
        taal = next((t for t in TAALS if t.lower() in q.lower()), None)
        if not taal:
            return None
        m = re.search(r"matra\s+(\d+)", q, re.I)
        if m and not re.search(r"how (many|long)", q, re.I):
            return f"taal_{taal}_m{m.group(1)}"
        # A question comparing two taals (or asking about the whole cycle) is its own group per taal pair.
        mentioned = sorted(t for t in TAALS if t.lower() in q.lower())
        return f"taal_{'+'.join(mentioned)}"
    if cat == "terminology":
        low = q.lower()
        hits = [t for t in TERMS if re.search(r"\b" + t + r"\b", low)]
        if hits:
            return f"terminology_{'+'.join(sorted(hits))}"
        ragas = find_ragas(q, names)
        if ragas:
            return f"terminology_{ragas[0]}"
        concept = concept_of(q)
        return f"terminology_{concept}" if concept else None
    ragas = find_ragas(q, names)
    if cat == "comparison":
        pair = sorted(set(ragas))
        return f"comparison_{'+'.join(pair)}" if len(pair) >= 2 else None
    # raga_facts, aroha_avaroha, vadi_samvadi, beginner, advanced
    if ragas:
        return f"{cat}_{ragas[0]}"
    # Fall back to the answer, e.g. a question that names a raga only as "it".
    from_answer = find_ragas(a, names)
    if from_answer:
        return f"{cat}_{from_answer[0]}"
    concept = concept_of(q)
    return f"{cat}_{concept}" if concept else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", default=os.path.join(HERE, "training-questions.xlsx"))
    args = ap.parse_args()

    df = pd.read_excel(args.xlsx)
    missing = {"category", "question", "answer", "angle_type"} - set(df.columns)
    if missing:
        sys.exit(f"Workbook is missing columns: {sorted(missing)}")
    for col in df.columns:
        df[col] = df[col].map(norm)
    before = len(df)
    df = df[(df.question != "") & (df.answer != "")]
    unknown = set(df.category) - set(CATEGORIES)
    if unknown:
        sys.exit(f"Unknown categories in workbook: {sorted(unknown)}")
    df = df.drop_duplicates(["question"], keep="first").reset_index(drop=True)
    print(f"Read {before} rows, kept {len(df)} (dropped blank or duplicate questions).")
    probes = eval_probe_questions()
    leaked = df[df.question.isin(probes)]
    if len(leaked):
        print(f"Removed {len(leaked)} question(s) that are also evaluation probes:")
        for q in leaked.question:
            print(f"  - {q}")
        df = df[~df.question.isin(probes)].reset_index(drop=True)

    names = known_ragas(df)
    print(f"Real ragas found ({len(names)}): {', '.join(sorted(names))}")

    per_cat = defaultdict(int)
    out = defaultdict(list)
    unresolved = []
    for row in df.itertuples(index=False):
        group = fact_group(row, names)
        if not group:
            unresolved.append(row._asdict())
            continue
        per_cat[row.category] += 1
        out[row.category].append(
            {
                "id": f"{row.category}_{per_cat[row.category]:05d}",
                "category": row.category,
                "subtype": row.angle_type,
                "difficulty": DIFFICULTY.get(row.category, "standard"),
                "instruction": row.question,
                "output": row.answer,
                "fact_group": group,
                "verification_status": "VERIFIED",
                "source": "training-questions.xlsx",
            }
        )

    os.makedirs(GEN, exist_ok=True)
    for i, cat in enumerate(CATEGORIES, 1):
        path = os.path.join(GEN, f"{i:02d}_{cat}.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for rec in out[cat]:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    unresolved_path = os.path.join(HERE, "unresolved.jsonl")
    if unresolved:
        with open(unresolved_path, "w", encoding="utf-8") as f:
            for r in unresolved:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    elif os.path.exists(unresolved_path):
        os.remove(unresolved_path)

    print(f"\n{'CATEGORY':<16}{'ROWS':>7}{'GROUPS':>8}")
    for cat in CATEGORIES:
        groups = {r["fact_group"] for r in out[cat]}
        print(f"{cat:<16}{len(out[cat]):>7}{len(groups):>8}")
    print(f"\nWritten: {sum(len(v) for v in out.values())}   Unresolved (left out): {len(unresolved)}")
    if unresolved:
        print(f"See {unresolved_path}")


if __name__ == "__main__":
    main()
