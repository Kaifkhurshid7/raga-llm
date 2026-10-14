"""
RAG retriever (layer: domain/infrastructure boundary to the corpus).

STATUS: stub. The retrieval corpus (built from the same verified
dataset/structured/ ground truth as training data -- see
docs/ARCHITECTURE.md Section 7) has not been built yet (PRD M4 is
"not started"). This stub exists so the API surface and the
serving_condition="rag" branch are already wired, and swapping in a
real vector index later is a change to this file only.
"""
from typing import List


class Retriever:
    def retrieve(self, query: str, top_k: int = 3) -> List[str]:
        raise NotImplementedError(
            "RAG retrieval corpus not yet built (see docs/PRD.md milestone M4). "
            "This stub intentionally fails loudly instead of returning fake passages."
        )


def get_retriever() -> Retriever:
    return Retriever()
