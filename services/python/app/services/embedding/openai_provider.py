from openai import AsyncOpenAI

from .base import BaseEmbeddingProvider


class OpenAIProvider(BaseEmbeddingProvider):
    """Embedding provider using OpenAI API."""

    def __init__(
        self,
        model: str = "text-embedding-3-small",
        api_key: str = "",
        base_url: str | None = None,
    ):
        self.model = model
        self._dimension: int | None = None
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = AsyncOpenAI(**kwargs)

    @property
    def dimension(self) -> int:
        if self._dimension is None:
            dim_map = {
                "text-embedding-3-small": 1536,
                "text-embedding-3-large": 3072,
            }
            self._dimension = dim_map.get(self.model, 1536)
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # OpenAI supports batch embedding (max 2048 per request)
        all_results = []
        batch_size = 2048
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            resp = await self.client.embeddings.create(
                model=self.model,
                input=batch,
            )
            all_results.extend([item.embedding for item in resp.data])
        return all_results

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]
