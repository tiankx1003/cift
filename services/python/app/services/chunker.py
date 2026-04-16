from __future__ import annotations

import re
import uuid


class TextChunker:
    """Split text into overlapping chunks."""

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 200, separators: list[str] | None = None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators

    def chunk_text(self, text: str) -> list[str]:
        if self.separators:
            return self._separator_chunk(text)
        return self._fixed_chunk(text)

    def _separator_chunk(self, text: str) -> list[str]:
        # Split by first separator, then further by next separators
        parts = [text]
        for sep in self.separators:
            new_parts = []
            for part in parts:
                new_parts.extend(part.split(sep))
            parts = new_parts

        # Merge small parts, split large parts
        chunks: list[str] = []
        current = ""
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if len(current) + len(part) + 1 <= self.chunk_size:
                current = current + "\n" + part if current else part
            else:
                if current:
                    chunks.append(current)
                if len(part) > self.chunk_size:
                    chunks.extend(self._fixed_chunk(part))
                    current = ""
                else:
                    current = part
        if current:
            chunks.append(current)
        return chunks

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


def _find_offset(text: str, chunk: str, start_from: int = 0) -> int:
    """Find the offset of chunk in text starting from start_from."""
    return text.find(chunk, start_from)


def make_chunks(
    text: str,
    file_type: str,
    chunk_size: int = 800,
    chunk_overlap: int = 200,
    separators: str = "",
) -> list[dict]:
    """Chunk text and return list of {id, content, metadata, start_offset, end_offset} dicts."""
    sep_list = [s.strip() for s in separators.split(",") if s.strip()] if separators else None

    if file_type == "md":
        chunker = MarkdownChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    else:
        chunker = TextChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap, separators=sep_list)

    raw_chunks = chunker.chunk_text(text)

    # Compute offsets by finding each chunk in the original text
    result = []
    search_from = 0
    for i, chunk in enumerate(raw_chunks):
        offset = _find_offset(text, chunk, search_from)
        if offset == -1:
            offset = search_from
        start_offset = offset
        end_offset = offset + len(chunk)
        result.append({
            "id": str(uuid.uuid4()),
            "content": chunk,
            "metadata": {"chunk_index": i},
            "start_offset": start_offset,
            "end_offset": end_offset,
        })
        search_from = end_offset

    return result
