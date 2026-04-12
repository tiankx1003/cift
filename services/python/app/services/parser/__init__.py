from .base import BaseParser
from .txt_parser import TxtParser
from .markdown_parser import MarkdownParser

_parsers: dict[str, BaseParser] = {
    "txt": TxtParser(),
    "md": MarkdownParser(),
}


def get_parser(file_type: str) -> BaseParser:
    parser = _parsers.get(file_type)
    if parser is None:
        raise ValueError(f"Unsupported file type: {file_type}")
    return parser


__all__ = ["BaseParser", "TxtParser", "MarkdownParser", "get_parser"]
