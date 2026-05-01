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

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64, separators: list[str] | None = None):
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

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64):
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


# Chinese heading patterns for plain text / PDF / DOCX extracted text
_TXT_HEADING_PATTERNS = [
    r"^第[一二三四五六七八九十百千\d]+[章章节]\s*",      # 第X章/节
    r"^[一二三四五六七八九十]+[、．]\s*",                  # 一、
    r"^[（\(][一二三四五六七八九十]+[）\)]\s*",            # （一）
    r"^\d+[\.．\s]\s*\S",                                  # 1. 标题
    r"^\d+\.\d+(?:\.\d+)*\s+\S",                           # 1.1 / 1.1.1 标题
    r"^[Cc]hapter\s+\d+",                                  # Chapter 1
]

_TXT_HEADING_RE = re.compile("|".join(_TXT_HEADING_PATTERNS), re.MULTILINE)


class StructuralChunker:
    """Split text by heading/section structure, preserving semantic completeness."""

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 64, heading_level: int = 0):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.heading_level = heading_level  # 1-6 for markdown, 0=auto

    def chunk_text(self, text: str, file_type: str = "txt") -> list[str]:
        if file_type == "md":
            return self._chunk_markdown(text)
        return self._chunk_plain(text)

    # -- Markdown -----------------------------------------------------------

    def _chunk_markdown(self, text: str) -> list[str]:
        level = self.heading_level if self.heading_level >= 1 else self._auto_detect_md_level(text)
        pattern = rf"^({'#' * level})\s+(.+)$"
        heading_re = re.compile(pattern, re.MULTILINE)
        matches = list(heading_re.finditer(text))

        if not matches:
            # No headings at this level; fall back to TextChunker
            return TextChunker(self.chunk_size, self.chunk_overlap).chunk_text(text)

        sections = self._build_sections(text, matches)
        return self._split_sections(sections)

    def _auto_detect_md_level(self, text: str) -> int:
        """Pick the heading level that produces the most balanced sections."""
        best_level = 2
        best_score = -1
        for lvl in range(1, 5):  # H1..H4
            pattern = rf"^({'#' * lvl})\s+(.+)$"
            count = len(re.findall(pattern, text, re.MULTILINE))
            if count == 0:
                continue
            avg_len = len(text) / count
            # Prefer levels that produce sections around 1-3x chunk_size
            score = count if 0.5 * self.chunk_size <= avg_len <= 5 * self.chunk_size else 0
            if score > best_score:
                best_score = score
                best_level = lvl
        return best_level

    # -- Plain text / PDF / DOCX -------------------------------------------

    def _chunk_plain(self, text: str) -> list[str]:
        matches = list(_TXT_HEADING_RE.finditer(text))
        if not matches:
            return TextChunker(self.chunk_size, self.chunk_overlap).chunk_text(text)
        sections = self._build_sections(text, matches)
        return self._split_sections(sections)

    # -- Helpers ------------------------------------------------------------

    @staticmethod
    def _build_sections(text: str, matches: list[re.Match]) -> list[str]:
        sections: list[str] = []
        if matches[0].start() > 0:
            sections.append(text[: matches[0].start()])
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            sections.append(text[start:end])
        return sections

    def _split_sections(self, sections: list[str]) -> list[str]:
        chunks: list[str] = []
        for section in sections:
            section = section.strip()
            if not section:
                continue
            if len(section) <= self.chunk_size:
                chunks.append(section)
            else:
                # Secondary split with separator alignment
                sub = TextChunker(self.chunk_size, self.chunk_overlap).chunk_text(section)
                chunks.extend(sub)
        return chunks


def _find_offset(text: str, chunk: str, start_from: int = 0) -> int:
    """Find the offset of chunk in text starting from start_from."""
    return text.find(chunk, start_from)


def make_chunks(
    text: str,
    file_type: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
    separators: str = "",
    strategy: str = "fixed",
    heading_level: int = 0,
) -> list[dict]:
    """Chunk text and return list of {id, content, metadata, start_offset, end_offset} dicts.

    Args:
        strategy: "fixed" (default), "structural" (heading-based), or "markdown" (legacy).
        heading_level: For structural strategy — heading level 1-6, 0=auto-detect.
    """
    sep_list = [s.strip() for s in separators.split(",") if s.strip()] if separators else None

    if strategy == "structural":
        chunker = StructuralChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap, heading_level=heading_level)
        raw_chunks = chunker.chunk_text(text, file_type)
    elif file_type == "md":
        chunker = MarkdownChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        raw_chunks = chunker.chunk_text(text)
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
