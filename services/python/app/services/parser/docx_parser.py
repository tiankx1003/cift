import io

from docx import Document

from .base import BaseParser


class DocxParser(BaseParser):
    """Word (docx) parser — extracts text from all paragraphs using python-docx."""

    def parse(self, content: bytes) -> str:
        doc = Document(io.BytesIO(content))
        return "\n".join(para.text for para in doc.paragraphs)
