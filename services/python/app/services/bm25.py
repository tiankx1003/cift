"""Simple BM25 implementation for keyword search."""

import math
import re
from collections import Counter


def _tokenize(text: str) -> list[str]:
    """Tokenize text into words. Handles both English and Chinese."""
    tokens: list[str] = []
    # Split by whitespace for English-like words
    for part in re.split(r'\s+', text):
        if not part:
            continue
        # Extract alphanumeric sequences (English words)
        words = re.findall(r'[a-zA-Z0-9]+', part)
        tokens.extend(w.lower() for w in words)
        # Extract Chinese characters as bigrams + unigrams
        chinese = re.findall(r'[\u4e00-\u9fff]+', part)
        for seg in chinese:
            for ch in seg:
                tokens.append(ch)
            for i in range(len(seg) - 1):
                tokens.append(seg[i:i + 2])
    return tokens


class BM25Index:
    """BM25 index built from a corpus of documents."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus_tokens: list[list[str]] = []
        self.df: Counter = Counter()
        self.idf: dict[str, float] = {}
        self.avgdl: float = 0.0
        self.doc_count: int = 0

    def build(self, documents: list[str]) -> None:
        """Build the index from a list of document texts."""
        self.corpus_tokens = [_tokenize(doc) for doc in documents]
        self.doc_count = len(self.corpus_tokens)

        # Document frequency
        self.df = Counter()
        for tokens in self.corpus_tokens:
            for term in set(tokens):
                self.df[term] += 1

        # IDF
        self.idf = {}
        for term, freq in self.df.items():
            self.idf[term] = math.log((self.doc_count - freq + 0.5) / (freq + 0.5) + 1)

        # Average document length
        total_len = sum(len(t) for t in self.corpus_tokens)
        self.avgdl = total_len / self.doc_count if self.doc_count > 0 else 1.0

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        """Score all documents against the query, return top-k results.

        Returns: [{"index": int, "score": float}]
        """
        query_tokens = _tokenize(query)
        if not query_tokens or not self.corpus_tokens:
            return []

        scores: list[tuple[int, float]] = []
        for i, doc_tokens in enumerate(self.corpus_tokens):
            doc_len = len(doc_tokens)
            tf_map = Counter(doc_tokens)
            score = 0.0
            for qt in query_tokens:
                if qt not in self.idf:
                    continue
                tf = tf_map.get(qt, 0)
                idf = self.idf[qt]
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avgdl)
                score += idf * numerator / denominator
            scores.append((i, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return [{"index": idx, "score": s} for idx, s in scores[:top_k]]
