import httpx

from .base import BaseRerankProvider


class OpenAIRerankProvider(BaseRerankProvider):
    """Rerank provider using OpenAI-compatible rerank API."""

    def __init__(self, model: str, api_key: str, base_url: str = ""):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/") or "https://api.openai.com/v1"

    async def rerank(self, query: str, documents: list[str], top_k: int = 5) -> list[dict]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "query": query,
            "documents": documents,
            "top_k": top_k,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/rerank",
                headers=headers,
                json=payload,
                timeout=60.0,
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("results", []):
            results.append({
                "index": item["index"],
                "score": item["relevance_score"],
                "document": documents[item["index"]],
            })
        return results
