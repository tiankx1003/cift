from .base import BaseParser
from .txt_parser import TxtParser
from .markdown_parser import MarkdownParser
from .pdf_parser import PdfParser
from .docx_parser import DocxParser
from .csv_parser import CsvParser
from .json_parser import JsonParser

_parsers: dict[str, BaseParser] = {
    "txt": TxtParser(),
    "md": MarkdownParser(),
    "pdf": PdfParser(),
    "docx": DocxParser(),
    "csv": CsvParser(),
    "json": JsonParser(),
}


def get_parser(file_type: str) -> BaseParser:
    parser = _parsers.get(file_type)
    if parser is None:
        raise ValueError(f"Unsupported file type: {file_type}")
    return parser


__all__ = ["BaseParser", "TxtParser", "MarkdownParser", "PdfParser", "DocxParser", "CsvParser", "JsonParser", "get_parser"]
