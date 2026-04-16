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


# --- Upload ---

class UploadResponse(BaseModel):
    doc_id: str
    kb_id: str
    filename: str
    file_type: str  # "txt" | "md"
    file_size: int
    storage_key: str
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


# --- Knowledge Base ---

class CreateKbRequest(BaseModel):
    name: str
    description: str = ""


class KbInfo(BaseModel):
    kb_id: str
    name: str
    description: str
    doc_count: int = 0


class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int


# --- Chunks ---

class ChunkInfo(BaseModel):
    chunk_index: int
    content: str
    char_count: int


class ChunksResponse(BaseModel):
    chunks: list[ChunkInfo]
