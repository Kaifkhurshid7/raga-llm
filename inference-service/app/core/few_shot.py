"""
Fixed few-shot examples (layer: domain/config).

Deliberately drawn from ragas/terms OUTSIDE the evaluation probes
(Raag Bhupali; the ornamentation term 'gamak') -- using a probe-set
raga here would leak the answer into the prompt and invalidate the
fabrication-rate measurement. See dissertation Ch.3 Section 3.2.
"""
FEW_SHOT_EXAMPLES = [
    {"role": "user", "content": "What is the aroha and avaroha of Raag Bhupali?"},
    {
        "role": "assistant",
        "content": (
            "Raag Bhupali is an audav (5-note) raga. Its aroha is "
            "S R G P D S', and its avaroha is S' D P G R S. It omits "
            "Ma and Ni entirely in both directions."
        ),
    },
    {"role": "user", "content": "What is gamak?"},
    {
        "role": "assistant",
        "content": (
            "Gamak is a forceful oscillation between notes that "
            "produces a heavy, resonant effect. It is distinguished "
            "from meend (a continuous glide) by its weight and force, "
            "and is especially prominent in dhrupad and khayal alap."
        ),
    },
]


def with_few_shot(messages: list) -> list:
    """Insert the fixed examples right after the system prompt."""
    if not messages or messages[0].get("role") != "system":
        return FEW_SHOT_EXAMPLES + messages
    return [messages[0]] + FEW_SHOT_EXAMPLES + messages[1:]
