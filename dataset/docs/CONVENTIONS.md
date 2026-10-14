# Dataset Conventions (frozen)

These conventions are enforced automatically by `scripts/validate.py`. Changing
them requires re-validating the entire generated dataset, so they are frozen
deliberately rather than adjusted ad hoc during generation.

## Swara notation

- Valid character set: `SRGMPDNsrgmpdn' .,|-`
- Uppercase = shuddha (natural) swara: `S R G M P D N`
- Lowercase = komal (lowered) swara: `r g d n` (Re, Ga, Dha, Ni only)
- `M'` = tivra (raised) Ma — the only swara that can be raised
- `S'` = upper-octave Sa

**Do not** use Python's `str.capitalize()` or similar generic case-normalization
on swara strings — it lowercases every character after the first, silently
turning "Ma" into "ma" (a different, incorrect swara). Use a first-character-only
capitalization helper if normalization is needed at all.

**Do not** compare instructions case-insensitively when checking for duplicates —
case carries real musicological meaning here (e.g. Yaman's `N R G M' D N S'` vs.
Puriya's `N r G M' D N S'` are different sequences, not the same one re-cased).

## Banned transliterations

| Banned | Use instead |
|---|---|
| aaroh | aroha |
| avroh | avaroha |
| vaadi | vadi |
| samvaadi | samvadi |
| matraa | matra |
| gharaanaa | gharana |
| M(tivra), Ma tivra | M' |
| svara | swara |
| thaath | thaat |
| taala | taal |

## Verification status

Every record carries a `verification_status` field: `VERIFIED` or `UNVERIFIED`.
`validate.py --strict` exits non-zero if any `UNVERIFIED` record is present in
the set about to be used for training. Verification means the fact is traceable
to a cited source (primarily Bor & Rao, *The Raga Guide*).

## Contested facts

A fact that is genuinely disputed across gharanas/sources (e.g. whether *badhat*
and *vistar* are synonymous) is marked `contested: TRUE` in the structured CSV
and must be represented as contested in generated output — not flattened into
false certainty.

## Citations

Page-level citations (`p. 42`, `(1934, ...)`) must never appear in training
*output* text — they belong only in the retrieval corpus, where the cited
passage is real. `validate.py` scans for and rejects these patterns.

## Per-category answer length ranges (words)

| Category | Min | Max |
|---|---|---|
| raga_facts | 40 | 220 |
| aroha_avaroha | 30 | 180 |
| vadi_samvadi | 40 | 200 |
| comparison | 80 | 300 |
| terminology | 30 | 220 |
| taal | 40 | 220 |
| beginner | 60 | 240 |
| advanced | 80 | 300 |
| out_of_domain | 40 | 200 |
| grounded | 40 | 220 |
