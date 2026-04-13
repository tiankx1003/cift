import httpx

from .base import BaseEmbeddingProvider


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
            for text in texts:
                resp = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model, "prompt": text},
                    timeout=60.0,
                )
                resp.raise_for_status()
                data = resp.json()
                results.append(data["embedding"])
        return results

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]
