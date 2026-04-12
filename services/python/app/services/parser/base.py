from abc import ABC, abstractmethod


class BaseParser(ABC):
    """Abstract base class for document parsers."""

    @abstractmethod
    def parse(self, content: bytes) -> str:
        """Parse file content bytes into plain text."""
        ...
