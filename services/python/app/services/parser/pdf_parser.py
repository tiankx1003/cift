import io

import fitz  # pymupdf

from .base import BaseParser


class PdfParser(BaseParser):
    """PDF parser — extracts text from each page using PyMuPDF."""

    def parse(self, content: bytes) -> str:
        doc = fitz.open(stream=content, filetype="pdf")
        try:
            pages = [page.get_text() for page in doc]
            return "\n".join(pages)
        finally:
            doc.close()
