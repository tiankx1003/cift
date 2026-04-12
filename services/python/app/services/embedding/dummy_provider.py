"""Dummy embedding provider for local development / testing."""

import hashlib

from .base import BaseEmbeddingProvider


class DummyProvider(BaseEmbeddingProvider):
    """Returns random vectors. Use only for testing."""

    def __init__(self, dimension: int = 128):
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._hash_vector(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._hash_vector(text)

    def _hash_vector(self, text: str) -> list[float]:
        """Generate a deterministic pseudo-random vector from text hash."""
        h = hashlib.sha256(text.encode()).digest()
        vec = []
        for i in range(self._dimension):
            # Use byte value normalized to [-1, 1]
            val = (h[i % len(h)] / 127.5) - 1.0
            vec.append(val)
        return vec
