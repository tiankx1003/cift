from abc import ABC, abstractmethod
from typing import AsyncGenerator


class BaseLLMClient(ABC):
    @abstractmethod
    async def chat(self, messages: list[dict]) -> str:
        """Send messages and return the assistant response text."""
        ...

    async def chat_stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        """Stream chat tokens. Default: fall back to non-streaming."""
        yield await self.chat(messages)
