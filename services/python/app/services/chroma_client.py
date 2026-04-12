from __future__ import annotations

import chromadb

from app.utils.config import Settings, get_settings


def get_chroma_client(settings: Settings | None = None) -> chromadb.ClientAPI:
    settings = settings or get_settings()
    if settings.chroma_host:
        return chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )
    # Fallback: embedded persistent client for local dev
    return chromadb.PersistentClient(path=settings.chroma_path)


def get_or_create_collection(
    client: chromadb.ClientAPI, kb_id: str, dimension: int
):
    return client.get_or_create_collection(
        name=kb_id,
        metadata={"hnsw:space": "cosine"},
    )
