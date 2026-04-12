from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Embedding
    embedding_provider: str = "dummy"
    embedding_model: str = "text-embedding-3-small"

    # MLX
    mlx_model_name: str = "mlx-community/bge-small-zh-v1.5-mlx"
    mlx_batch_size: int = 32

    # Ollama
    ollama_base_url: str = "http://ollama:11434"

    # llama.cpp
    llama_cpp_model_path: str = ""
    llama_cpp_n_gpu_layers: int = -1
    llama_cpp_n_batch: int = 512

    # OpenAI
    openai_api_key: str = ""
    openai_base_url: str = ""

    # ChromaDB: set chroma_host="" to use embedded persistent mode
    chroma_host: str = ""
    chroma_port: int = 8000
    chroma_path: str = "./chroma_data"

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "cift-files"
    minio_secure: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
