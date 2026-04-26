from __future__ import annotations

import re
import uuid

# Default separator list, ordered by priority (highest to lowest)
DEFAULT_SEPARATORS = [
    "\n\n",  # paragraph break
    "\n",    # newline
    "。",    # Chinese period
    "？",    # Chinese question mark
    "！",    # Chinese exclamation mark
    "；",    # Chinese semicolon
    ".",     # English period
    "?",     # English question mark
    "!",     # English exclamation mark
    " ",     # space (lowest priority fallback)
]


def _find_split_point(text: str, target_pos: int, separators: list[str], max_len: int) -> int:
    """Find the best split point near target_pos by searching for separators.

    Returns the position right AFTER the chosen separator.
    """
    # Search forward from target_pos
    best_forward = None
    best_forward_dist = len(text)
    for sep in separators:
        idx = text.find(sep, target_pos)
        if idx != -1:
            split_pos = idx + len(sep)
            dist = split_pos - target_pos
            if dist < best_forward_dist:
                best_forward = split_pos
                best_forward_dist = dist

    # Search backward from target_pos
    best_backward = None
    best_backward_dist = target_pos
    for sep in separators:
        idx = text.rfind(sep, 0, target_pos)
        if idx != -1:
            split_pos = idx + len(sep)
            dist = target_pos - split_pos
            if dist < best_backward_dist:
                best_backward = split_pos
                best_backward_dist = dist

    # Pick the closer one
    candidates = []
    if best_backward is not None:
        candidates.append((best_backward_dist, best_backward))
    if best_forward is not None:
        candidates.append((best_forward_dist, best_forward))

    if not candidates:
        # No separator found at all, force split at target_pos
        return target_pos

    candidates.sort(key=lambda x: x[0])
    split_pos = candidates[0][1]

    # Enforce max_len: if the split would make a chunk longer than max_len, force at target_pos
    # This ensures no chunk exceeds 2x chunk_size
    return split_pos


class TextChunker:
    """Split text into overlapping chunks with separator alignment."""

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 200, separators: list[str] | None = None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators

    def chunk_text(self, text: str) -> list[str]:
        if self.separators:
            return self._separator_chunk(text)
        return self._aligned_chunk(text, DEFAULT_SEPARATORS)

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
                    chunks.extend(self._aligned_chunk(part, DEFAULT_SEPARATORS))
                    current = ""
                else:
                    current = part
        if current:
            chunks.append(current)
        return chunks

    def _aligned_chunk(self, text: str, separators: list[str]) -> list[str]:
        """Chunk text with separator alignment near chunk_size boundaries."""
        text = text.strip()
        if len(text) <= self.chunk_size:
            return [text] if text else []

        chunks = []
        start = 0
        max_chunk_len = self.chunk_size * 2

        while start < len(text):
            # Remaining text fits in one chunk
            if start + self.chunk_size >= len(text):
                remainder = text[start:]
                if remainder.strip():
                    chunks.append(remainder)
                break

            # Find ideal split point near chunk_size from current start
            target_pos = start + self.chunk_size
            split_pos = _find_split_point(text, target_pos, separators, max_chunk_len)

            # Ensure we make progress and don't exceed max_chunk_len
            if split_pos <= start:
                split_pos = target_pos
            if split_pos - start > max_chunk_len:
                split_pos = start + self.chunk_size

            chunk_text = text[start:split_pos]
            if chunk_text.strip():
                chunks.append(chunk_text)

            # Move start back by overlap, but ensure forward progress
            start = max(split_pos - self.chunk_overlap, split_pos)

        return chunks


class MarkdownChunker:
    """Split markdown by heading sections, then aligned-size for long sections."""

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
                # Fall back to aligned chunking for long sections
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
