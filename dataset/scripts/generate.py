#!/usr/bin/env python3
"""
Expand structured CSV ground truth (dataset/structured/) into
instruction/output JSONL records (dataset/generated/), one file per
category, per docs/CONVENTIONS.md.

This is a reference implementation covering the core angle templates
per category; it is meant to be extended, not treated as exhaustive.
Only VERIFIED rows are expanded into categories other than
'out_of_domain' -- an UNVERIFIED row like Shivangi in ragas.csv is
intentionally skipped here and left for a cross-check before it is
promoted to VERIFIED and re-run.
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRUCTURED = os.path.join(HERE, "structured")
GENERATED = os.path.join(HERE, "generated")

os.makedirs(GENERATED, exist_ok=True)


def load_csv(name):
    path = os.path.join(STRUCTURED, name)
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_jsonl(filename, records):
    path = os.path.join(GENERATED, filename)
    with open(path, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"  wrote {len(records):4d} records -> {filename}")


def cap(word: str) -> str:
    """First-character-only capitalization -- see CONVENTIONS.md.
    NEVER use str.capitalize() on swara notation; it corrupts it."""
    if not word:
        return word
    return word[0].upper() + word[1:]


def make_record(idx, category, subtype, difficulty, instruction, output, fact_group, status):
    return {
        "id": f"{category}_{idx:04d}",
        "category": category,
        "subtype": subtype,
        "difficulty": difficulty,
        "instruction": instruction,
        "output": output,
        "fact_group": fact_group,
        "verification_status": status,
    }


def generate_raga_facts(ragas):
    records = []
    idx = 0
    for r in ragas:
        if r["verification_status"] != "VERIFIED":
            continue
        idx += 1
        instr = f"Tell me the key facts about Raag {r['raga_name']}."
        out = (
            f"Raag {r['raga_name']} belongs to {r['thaat']} thaat. "
            f"Its vadi (most emphasized note) is {r['vadi']}, and its samvadi "
            f"(second-most emphasized, consonant note) is {r['samvadi']}. "
            f"It is traditionally performed during {r['samay']}, following the "
            f"samay system that assigns ragas to times of day. Its jati "
            f"(aroha-avaroha note count classification) is {r['jati']}. "
            f"Its aroha is {r['aroha']} and its avaroha is {r['avaroha']}."
        )
        # fact_group is category-specific: the SAME raga contributes a
        # different fact_group per category, so the stratified split
        # never has to decide which category a shared group "belongs to".
        records.append(make_record(idx, "raga_facts", "overview", "basic",
                                     instr, out, f"raga_facts_{r['raga_name']}", r["verification_status"]))
    return records


def generate_vadi_samvadi(ragas):
    records = []
    idx = 0
    for r in ragas:
        if r["verification_status"] != "VERIFIED":
            continue
        idx += 1
        instr = f"What are the vadi and samvadi of Raag {r['raga_name']}?"
        out = (
            f"In Raag {r['raga_name']}, the vadi (most emphasized note, the one "
            f"around which the raga's melodic identity is built) is {r['vadi']}. "
            f"The samvadi -- the second-most emphasized note, consonant with the "
            f"vadi -- is {r['samvadi']}. Together these two notes anchor how the "
            f"raga is developed and recognized in performance."
        )
        records.append(make_record(idx, "vadi_samvadi", "direct", "basic",
                                     instr, out, f"vadi_samvadi_{r['raga_name']}", r["verification_status"]))
    return records


def generate_aroha_avaroha(ragas):
    records = []
    idx = 0
    for r in ragas:
        if r["verification_status"] != "VERIFIED":
            continue
        idx += 1
        instr = f"What is the aroha and avaroha of Raag {r['raga_name']}?"
        out = (
            f"Raag {r['raga_name']}'s aroha (the ascending note sequence used "
            f"when the melody rises toward the upper octave) is {r['aroha']}. "
            f"Its avaroha (the descending sequence used when the melody returns "
            f"toward the lower octave) is {r['avaroha']}. The raga's jati, "
            f"{r['jati']}, describes how many distinct swaras this ascending "
            f"and descending pattern actually uses."
        )
        records.append(make_record(idx, "aroha_avaroha", "direct", "basic",
                                     instr, out, f"aroha_avaroha_{r['raga_name']}", r["verification_status"]))
    return records


def generate_terminology(concepts):
    records = []
    idx = 0
    for c in concepts:
        if c["verification_status"] != "VERIFIED":
            continue
        idx += 1
        instr = f"What is {c['concept_name']} in Hindustani classical music?"
        contested_note = (
            " Note that sources differ on exactly how this is defined, "
            "so this should be read as the common usage rather than settled fact."
            if c["contested"] == "TRUE" else ""
        )
        out = (
            f"{cap(c['concept_name'])} is {c['definition']}. In practice, this means "
            f"it is distinguished from the related concept of {c['contrasts_with']} "
            f"primarily by {c['distinguishing_axis']} -- that is the specific thing "
            f"to listen for if you are trying to tell the two apart in a performance."
            f"{contested_note}"
        )
        records.append(make_record(idx, "terminology", "definition", "basic",
                                     instr, out, f"terminology_{c['concept_name']}", c["verification_status"]))
    return records


def generate_taal(taals):
    records = []
    idx = 0
    for t in taals:
        if t["verification_status"] != "VERIFIED":
            continue
        idx += 1
        instr = f"Explain the structure of {t['taal_name']}."
        out = (
            f"{t['taal_name']} is built from {t['matras']} matras (beats), divided "
            f"into the vibhag (section) pattern {t['vibhag_pattern']}. Its theka -- "
            f"the fixed set of bols (rhythmic syllables) that identifies this taal "
            f"on the tabla -- is: {t['theka_bols']}. The vibhag structure is what a "
            f"listener uses to track where the sam (the first beat of the cycle) "
            f"will fall."
        )
        records.append(make_record(idx, "taal", "structure", "basic",
                                     instr, out, f"taal_{t['taal_name']}", t["verification_status"]))
    return records


def generate_out_of_domain():
    """Calibrated-refusal examples -- the core anti-hallucination category.

    IMPORTANT: these fake raga/term names are deliberately DISJOINT from
    the ones used in finetuning/eval/hallucination_probe.jsonl (which
    uses Megharaag Deepak, Nilambari Kalyan, Chandrapriya, Suvarnamalika,
    'tarangam'). Training the model to refuse on these specific made-up
    names, then evaluating refusal on a DIFFERENT set of made-up names,
    is what actually tests generalized calibrated refusal rather than
    memorization of a fixed blocklist -- and reusing the same fake names
    in both places is exactly the contamination contamination_check.py
    is designed to catch (it caught it once during this build; see
    dataset/docs/CONVENTIONS.md)."""
    fake_queries = [
        ("Priyavarnika", "vadi"),
        ("Kalindi Sarang", "thaat"),
        ("Madhuranjani", "aroha and avaroha"),
        ("Vasantapriya", "samvadi"),
    ]
    records = []
    for idx, (fake_name, asked_about) in enumerate(fake_queries, start=1):
        instr = f"What is the {asked_about} of Raag {fake_name}?"
        out = (
            f"I don't have a verified record of a raga called '{fake_name}' in the "
            f"sources I was trained on. Rather than guess at its {asked_about}, I'd "
            f"rather say plainly that I can't confirm this raga exists in the standard "
            f"Bhatkhande-system references I was trained against -- if you have a "
            f"source for it, I'm happy to look at it with you and update my answer."
        )
        records.append(make_record(idx, "out_of_domain", "nonexistent_raga", "basic",
                                     instr, out, f"out_of_domain_{idx:03d}", "VERIFIED"))
    return records


def main():
    ragas = load_csv("ragas.csv")
    concepts = load_csv("concepts.csv")
    taals = load_csv("taals.csv")

    print("Generating dataset from structured ground truth...")
    write_jsonl("01_raga_facts.jsonl", generate_raga_facts(ragas))
    write_jsonl("02_aroha_avaroha.jsonl", generate_aroha_avaroha(ragas))
    write_jsonl("03_vadi_samvadi.jsonl", generate_vadi_samvadi(ragas))
    write_jsonl("04_terminology.jsonl", generate_terminology(concepts))
    write_jsonl("05_taal.jsonl", generate_taal(taals))
    write_jsonl("09_out_of_domain.jsonl", generate_out_of_domain())
    print("Done. Run validate.py next.")


if __name__ == "__main__":
    main()
