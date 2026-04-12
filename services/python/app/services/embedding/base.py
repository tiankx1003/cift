from abc import ABC, abstractmethod


class BaseEmbeddingProvider(ABC):
    """Abstract base class for all embedding providers."""

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a batch of texts."""
        ...

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]:
        """Generate embedding for a single query text."""
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding vector dimension."""
        ...
