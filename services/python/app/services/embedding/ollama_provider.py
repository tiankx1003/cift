import httpx

from .base import BaseEmbeddingProvider

BATCH_SIZE = 32


class OllamaProvider(BaseEmbeddingProvider):
    """Embedding provider using Ollama API."""

    def __init__(self, model: str, base_url: str = "http://ollama:11434"):
        self.model = model
        self.base_url = base_url.rstrip("/")
        self._dimension: int | None = None

    @property
    def dimension(self) -> int:
        if self._dimension is None:
            resp = httpx.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": "test"},
                timeout=60.0,
            )
            resp.raise_for_status()
            self._dimension = len(resp.json()["embedding"])
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        results = []
        async with httpx.AsyncClient() as client:
            for i in range(0, len(texts), BATCH_SIZE):
                batch = texts[i:i + BATCH_SIZE]
                # Use /api/embed (batch endpoint, Ollama >= 0.1.26)
                resp = await client.post(
                    f"{self.base_url}/api/embed",
                    json={"model": self.model, "input": batch},
                    timeout=120.0,
                )
                if resp.status_code == 404:
                    # Fallback to single-prompt endpoint for older Ollama
                    for text in batch:
                        r = await client.post(
                            f"{self.base_url}/api/embeddings",
                            json={"model": self.model, "prompt": text},
                            timeout=60.0,
                        )
                        r.raise_for_status()
                        results.append(r.json()["embedding"])
                else:
                    resp.raise_for_status()
                    results.extend(resp.json()["embeddings"])
        return results

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]
