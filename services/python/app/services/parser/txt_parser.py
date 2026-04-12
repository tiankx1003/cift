from .base import BaseParser


class TxtParser(BaseParser):
    """Plain text parser."""

    def parse(self, content: bytes) -> str:
        return content.decode("utf-8")
