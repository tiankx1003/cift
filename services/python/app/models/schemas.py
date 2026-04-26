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
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    separators: str | None = None


# --- Chunks ---

class ChunkInfo(BaseModel):
    chunk_index: int
    content: str
    char_count: int
    start_offset: int | None = None
    end_offset: int | None = None


class ChunksResponse(BaseModel):
    extracted_text: str = ""
    chunks: list[ChunkInfo]


# --- Chunk Config ---

class ChunkConfigCreate(BaseModel):
    name: str
    chunk_size: int = 800
    chunk_overlap: int = 200
    separators: str = ""
    strategy: str = "fixed"       # "fixed" | "structural"
    heading_level: int = 0        # 0=auto, 1-6

class ChunkConfigUpdate(BaseModel):
    name: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    separators: str | None = None
    strategy: str | None = None
    heading_level: int | None = None

class ChunkConfigInfo(BaseModel):
    id: str
    name: str
    chunk_size: int
    chunk_overlap: int
    separators: str
    strategy: str = "fixed"
    heading_level: int = 0
    is_default: bool

class ChunkRequest(BaseModel):
    kb_id: str
    config_id: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    separators: str | None = None
    strategy: str | None = None
    heading_level: int | None = None


class ChunkTaskResponse(BaseModel):
    task_id: str
    doc_id: str
    status: str
    progress: int = 0
    total_chunks: int = 0
    current_chunk: int = 0
    error_message: str | None = None


# --- Model Config ---

class ModelConfigCreate(BaseModel):
    model_type: str  # "llm" | "embedding" | "rerank"
    provider: str    # "ollama" | "openai" | "mlx" | "llama_cpp"
    model_name: str
    base_url: str = ""
    api_key: str = ""
    extra_params: str | None = None

class ModelConfigUpdate(BaseModel):
    provider: str | None = None
    model_name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    extra_params: str | None = None

class ModelConfigInfo(BaseModel):
    id: str
    model_type: str
    provider: str
    model_name: str
    base_url: str
    api_key: str  # masked in response by router
    is_active: bool
    extra_params: str | None = None
