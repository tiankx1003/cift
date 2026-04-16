from abc import ABC, abstractmethod


class BaseLLMClient(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict]) -> str:
        """Send messages and return the assistant response text."""
        ...
