import httpx

from .base import BaseRerankProvider


class OllamaRerankProvider(BaseRerankProvider):
    """Rerank provider using Ollama (uses embedding similarity as proxy)."""

    def __init__(self, model: str, base_url: str = "http://localhost:11434"):
        self.model = model
        self.base_url = base_url.rstrip("/")

    async def rerank(self, query: str, documents: list[str], top_k: int = 5) -> list[dict]:
        async with httpx.AsyncClient() as client:
            # Embed query and documents
            query_resp = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": query},
                timeout=60.0,
            )
            query_resp.raise_for_status()
            query_emb = query_resp.json()["embedding"]

            scores = []
            for doc in documents:
                doc_resp = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model, "prompt": doc},
                    timeout=60.0,
                )
                doc_resp.raise_for_status()
                doc_emb = doc_resp.json()["embedding"]
                # Cosine similarity
                dot = sum(a * b for a, b in zip(query_emb, doc_emb))
                norm_q = sum(a * a for a in query_emb) ** 0.5
                norm_d = sum(b * b for b in doc_emb) ** 0.5
                score = dot / (norm_q * norm_d) if norm_q and norm_d else 0.0
                scores.append(score)

        ranked = sorted(
            [{"index": i, "score": s, "document": documents[i]} for i, s in enumerate(scores)],
            key=lambda x: x["score"],
            reverse=True,
        )
        return ranked[:top_k]
