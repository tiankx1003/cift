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

        # Step 1: Chunk
        chunks = make_chunks(text, doc.file_type, chunk_size, chunk_overlap, separators)
        if not chunks:
            doc.status = "completed"
            doc.chunk_count = 0
            await db.commit()
            return {"doc_id": doc_id, "status": "completed", "chunk_count": 0}

        # Step 2: Embed in batches and store incrementally
        provider = create_embedding_provider(settings)
        chroma = get_chroma_client(settings)
        collection = get_or_create_collection(chroma, req.kb_id, provider.dimension)

        BATCH = 32
        stored = 0
        for i in range(0, len(chunks), BATCH):
            batch = chunks[i:i + BATCH]
            batch_texts = [c["content"] for c in batch]
            embeddings = await provider.embed(batch_texts)
            collection.add(
                ids=[c["id"] for c in batch],
                embeddings=embeddings,
                documents=batch_texts,
                metadatas=[
                    {
                        "doc_id": doc_id,
                        "chunk_index": c["metadata"]["chunk_index"],
                        "start_offset": c["start_offset"],
                        "end_offset": c["end_offset"],
                    }
                    for c in batch
                ],
            )
            stored += len(batch)
            logger.info(f"Embedded batch {i // BATCH + 1}/{(len(chunks) + BATCH - 1) // BATCH}, doc={doc_id}, progress={stored}/{len(chunks)}")

        # Update document
        old_chunk_count = doc.chunk_count or 0
        doc.status = "completed"
        doc.chunk_count = len(chunks)
        doc.chunk_size = chunk_size
        doc.chunk_overlap = chunk_overlap
        doc.separators = separators
        kb = await db.get(KnowledgeBase, req.kb_id)
        if kb:
            kb.doc_count = (kb.doc_count or 0) - old_chunk_count + len(chunks)
        await db.commit()

        logger.info(f"Chunked doc={doc_id}, chunks={len(chunks)}")
        return {"doc_id": doc_id, "status": "completed", "chunk_count": len(chunks)}

    except Exception as e:
        logger.error(f"Chunk failed doc={doc_id}: {e}")
        doc.status = "failed"
        doc.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))
