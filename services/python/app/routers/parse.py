from fastapi import APIRouter, HTTPException

from ..models import ParseRequest, ParseDirectRequest, ParseResponse
from ..services import (
    get_minio_client,
    download_file,
    get_parser,
    make_chunks,
    get_chroma_client,
    get_or_create_collection,
    create_embedding_provider,
)
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["parse"])


async def _parse_and_embed(doc_id: str, text: str, file_type: str, kb_id: str):
    """Core parse → chunk → embed → store pipeline."""
    settings = get_settings()

    chunks = make_chunks(text, file_type)
    if not chunks:
        return ParseResponse(doc_id=doc_id, status="completed", chunk_count=0)

    provider = create_embedding_provider(settings)
    texts = [c["content"] for c in chunks]
    embeddings = await provider.embed(texts)

    chroma = get_chroma_client(settings)
    collection = get_or_create_collection(chroma, kb_id, provider.dimension)
    collection.add(
        ids=[c["id"] for c in chunks],
        embeddings=embeddings,
        documents=texts,
        metadatas=[
            {"doc_id": doc_id, "chunk_index": c["metadata"]["chunk_index"]}
            for c in chunks
        ],
    )

    logger.info(f"Parsed doc={doc_id}, chunks={len(chunks)}")
    return ParseResponse(doc_id=doc_id, status="completed", chunk_count=len(chunks))


@router.post("/parse", response_model=ParseResponse)
async def parse_document(req: ParseRequest):
    settings = get_settings()

    try:
        minio = get_minio_client(settings)
        file_bytes = download_file(minio, req.storage_key, settings.minio_bucket)
        parser = get_parser(req.file_type)
        text = parser.parse(file_bytes)
        return await _parse_and_embed(req.doc_id, text, req.file_type, req.kb_id)
    except Exception as e:
        logger.error(f"Parse failed doc={req.doc_id}: {e}")
        return ParseResponse(doc_id=req.doc_id, status="failed", error_message=str(e))


@router.post("/parse-direct", response_model=ParseResponse)
async def parse_direct(req: ParseDirectRequest):
    """Parse with raw content — bypasses MinIO, useful for testing."""
    try:
        return await _parse_and_embed(req.doc_id, req.content, req.file_type, req.kb_id)
    except Exception as e:
        logger.error(f"Parse-direct failed doc={req.doc_id}: {e}")
        return ParseResponse(doc_id=req.doc_id, status="failed", error_message=str(e))
