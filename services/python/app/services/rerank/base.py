from abc import ABC, abstractmethod


class BaseRerankProvider(ABC):
    @abstractmethod
    async def rerank(self, query: str, documents: list[str], top_k: int = 5) -> list[dict]:
        """Return [{"index": int, "score": float, "document": str}]"""
        ...
