import re

from .base import BaseParser


class MarkdownParser(BaseParser):
    """Markdown parser — strips non-content markup, keeps text."""

    def parse(self, content: bytes) -> str:
        text = content.decode("utf-8")
        # Remove image tags but keep alt text
        text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
        # Remove links but keep link text
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        # Remove HTML tags
        text = re.sub(r"<[^>]+>", "", text)
        return text
