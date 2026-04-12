from pydantic import BaseModel


# --- Parse ---

class ParseRequest(BaseModel):
    doc_id: str
    storage_key: str
    file_type: str  # "txt" | "md"
    kb_id: str


class ParseDirectRequest(BaseModel):
    """Direct parse with content (bypass MinIO, for testing)."""
    doc_id: str
    content: str
    file_type: str  # "txt" | "md"
    kb_id: str


class ParseResponse(BaseModel):
    doc_id: str
    status: str  # "completed" | "failed"
    chunk_count: int = 0
    error_message: str | None = None


# --- Search ---

class SearchRequest(BaseModel):
    kb_id: str
    query: str
    top_k: int = 5


class SearchResult(BaseModel):
    chunk_id: str
    content: str
    score: float
    metadata: dict


class SearchResponse(BaseModel):
    results: list[SearchResult]


# --- Vectors ---

class VectorDeleteRequest(BaseModel):
    doc_id: str | None = None  # None means delete all vectors in the kb
