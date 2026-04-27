import csv
import io

from .base import BaseParser


class CsvParser(BaseParser):
    """Parse CSV file bytes into readable text."""

    def parse(self, content: bytes) -> str:
        # Try multiple encodings
        text = None
        for encoding in ("utf-8", "gbk", "latin-1"):
            try:
                text = content.decode(encoding)
                break
            except (UnicodeDecodeError, LookupError):
                continue
        if text is None:
            text = content.decode("utf-8", errors="replace")

        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return ""

        headers = rows[0]
        lines = []
        for i, row in enumerate(rows[1:], start=1):
            parts = []
            for j, val in enumerate(row):
                header = headers[j] if j < len(headers) else f"col_{j}"
                parts.append(f"{header}: {val}")
            lines.append(f"[Row {i}] " + ", ".join(parts))

        return "\n".join(lines)
