import json

from .base import BaseParser


class JsonParser(BaseParser):
    """Parse JSON file bytes into readable text."""

    def parse(self, content: bytes) -> str:
        text = content.decode("utf-8", errors="replace")
        obj = json.loads(text)

        if isinstance(obj, list):
            # Array of objects/elements
            lines = []
            for i, item in enumerate(obj):
                if isinstance(item, dict):
                    parts = [f"{k}: {v}" for k, v in self._flatten(item).items()]
                    lines.append(f"[{i}] " + ", ".join(parts))
                else:
                    lines.append(f"[{i}] {item}")
            return "\n".join(lines)

        if isinstance(obj, dict):
            # Single object — flatten key-value pairs
            flat = self._flatten(obj)
            return "\n".join(f"{k}: {v}" for k, v in flat.items())

        # Fallback: pretty-print
        return json.dumps(obj, indent=2, ensure_ascii=False)

    @staticmethod
    def _flatten(d: dict, prefix: str = "") -> dict:
        """Recursively flatten a nested dict."""
        out: dict = {}
        for k, v in d.items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                out.update(JsonParser._flatten(v, key))
            elif isinstance(v, list):
                out[key] = json.dumps(v, ensure_ascii=False)
            else:
                out[key] = v
        return out
