import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import ChunkRequest
from ..services import (
    get_chroma_client,
    get_or_create_collection,
    create_embedding_provider,
    get_db,
    Document,
    KnowledgeBase,
    ChunkConfig,
    make_chunks,
)
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["chunking"])


@router.post("/documents/{doc_id}/chunk")
async def chunk_document(doc_id: str, req: ChunkRequest, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.kb_id != req.kb_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this KB")
    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document has no extracted text")

    text = doc.extracted_text

    # Resolve chunk parameters
    chunk_size = 800
    chunk_overlap = 200
    separators = ""

    if req.config_id:
        config = await db.get(ChunkConfig, req.config_id)
        if not config or config.kb_id != req.kb_id:
            raise HTTPException(status_code=404, detail="Chunk config not found")
        chunk_size = config.chunk_size
        chunk_overlap = config.chunk_overlap
        separators = config.separators
    else:
        if req.chunk_size is not None:
            chunk_size = req.chunk_size
        if req.chunk_overlap is not None:
            chunk_overlap = req.chunk_overlap
        if req.separators is not None:
            separators = req.separators

    settings = get_settings()

    try:
        # Delete old vectors if re-chunking
        chroma = get_chroma_client(settings)
        try:
            collection = chroma.get_collection(req.kb_id)
            # Delete existing vectors for this doc
            existing = collection.get(where={"doc_id": doc_id})
            if existing["ids"]:
                collection.delete(ids=existing["ids"])
        except Exception:
            pass

        # Chunk
        chunks = make_chunks(text, doc.file_type, chunk_size, chunk_overlap, separators)
        if not chunks:
            doc.status = "completed"
            doc.chunk_count = 0
            await db.commit()
            return {"doc_id": doc_id, "status": "completed", "chunk_count": 0}

        # Embed
        provider = create_embedding_provider(settings)
        texts = [c["content"] for c in chunks]
        embeddings = await provider.embed(texts)

        # Store in ChromaDB
        chroma = get_chroma_client(settings)
        collection = get_or_create_collection(chroma, req.kb_id, provider.dimension)
        collection.add(
            ids=[c["id"] for c in chunks],
            embeddings=embeddings,
            documents=texts,
            metadatas=[
                {
                    "doc_id": doc_id,
                    "chunk_index": c["metadata"]["chunk_index"],
                    "start_offset": c["start_offset"],
                    "end_offset": c["end_offset"],
                }
                for c in chunks
            ],
        )

        # Update document
        doc.status = "completed"
        doc.chunk_count = len(chunks)
        kb = await db.get(KnowledgeBase, req.kb_id)
        if kb and doc.chunk_count == 0:
            pass  # Don't increment if re-chunking
        await db.commit()

        logger.info(f"Chunked doc={doc_id}, chunks={len(chunks)}")
        return {"doc_id": doc_id, "status": "completed", "chunk_count": len(chunks)}

    except Exception as e:
        logger.error(f"Chunk failed doc={doc_id}: {e}")
        doc.status = "failed"
        doc.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))
