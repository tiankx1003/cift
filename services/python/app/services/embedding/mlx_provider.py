from .base import BaseEmbeddingProvider


class MLXProvider(BaseEmbeddingProvider):
    """Embedding provider using MLX-LM on Apple Silicon."""

    def __init__(self, model_name: str, batch_size: int = 32):
        self.model_name = model_name
        self.batch_size = batch_size
        self._dimension: int | None = None
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return
        try:
            from mlx_embeddings import MLXEmbeddings

            self._model = MLXEmbeddings(model_name=self.model_name)
        except ImportError:
            raise ImportError(
                "mlx-lm is required for MLX provider. "
                "Install with: pip install mlx-lm"
            )

    @property
    def dimension(self) -> int:
        if self._dimension is None:
            import numpy as np

            self._load_model()
            vec = self._model.embed(["test"])
            self._dimension = len(vec[0])
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self._load_model()
        results = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            embeddings = self._model.embed(batch)
            results.extend(embeddings)
        return results

    async def embed_query(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]
