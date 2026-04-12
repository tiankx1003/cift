from __future__ import annotations

import re
import uuid


class TextChunker:
    """Split text into overlapping chunks."""

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_text(self, text: str) -> list[str]:
        return self._fixed_chunk(text)

    def _fixed_chunk(self, text: str) -> list[str]:
        text = text.strip()
        if len(text) <= self.chunk_size:
            return [text] if text else []

        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunks.append(text[start:end])
            start = end - self.chunk_overlap
        return chunks


class MarkdownChunker:
    """Split markdown by heading sections, then fixed-size for long sections."""

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._heading_re = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)

    def chunk_text(self, text: str) -> list[str]:
        sections = self._split_by_headings(text)
        chunks = []
        for section in sections:
            section = section.strip()
            if not section:
                continue
            if len(section) <= self.chunk_size:
                chunks.append(section)
            else:
                # Fall back to fixed-size chunking for long sections
                chunker = TextChunker(self.chunk_size, self.chunk_overlap)
                chunks.extend(chunker.chunk_text(section))
        return chunks

    def _split_by_headings(self, text: str) -> list[str]:
        matches = list(self._heading_re.finditer(text))
        if not matches:
            return [text]

        sections = []
        # Text before first heading
        if matches[0].start() > 0:
            sections.append(text[: matches[0].start()])

        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            sections.append(text[start:end])
        return sections


def make_chunks(text: str, file_type: str) -> list[dict]:
    """Chunk text and return list of {id, content, metadata} dicts."""
    if file_type == "md":
        chunker = MarkdownChunker()
    else:
        chunker = TextChunker()

    raw_chunks = chunker.chunk_text(text)
    return [
        {
            "id": str(uuid.uuid4()),
            "content": chunk,
            "metadata": {"chunk_index": i},
        }
        for i, chunk in enumerate(raw_chunks)
    ]
