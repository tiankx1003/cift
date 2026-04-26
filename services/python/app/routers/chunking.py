import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import ChunkRequest, ChunkTaskResponse
from ..services import (
    get_chroma_client,
    get_or_create_collection,
    create_embedding_provider,
    get_db,
    Document,
    KnowledgeBase,
    ChunkConfig,
    ChunkTask,
    make_chunks,
)
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["chunking"])


async def _run_chunk_task(task_id: str, doc_id: str, kb_id: str, chunk_size: int, chunk_overlap: int, separators: str):
    """Background task that performs the actual chunking + embedding."""
    settings = get_settings()
    from ..services.database import _get_engine, async_sessionmaker, AsyncSession

    _, factory = _get_engine()

    try:
        async with factory() as db:
            task = await db.get(ChunkTask, task_id)
            if not task:
                return

            task.status = "processing"
            await db.commit()

            doc = await db.get(Document, doc_id)
            if not doc or not doc.extracted_text:
                task.status = "failed"
                task.error_message = "Document not found or no extracted text"
                await db.commit()
                return

            text = doc.extracted_text

            # Delete old vectors if re-chunking
            chroma = get_chroma_client(settings)
            try:
                collection = chroma.get_collection(kb_id)
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
                task.status = "completed"
                task.progress = 100
                task.total_chunks = 0
                task.current_chunk = 0
                await db.commit()
                return

            task.total_chunks = len(chunks)
            await db.commit()

            # Step 2: Embed in batches and store incrementally
            provider = create_embedding_provider(settings)
            chroma = get_chroma_client(settings)
            collection = get_or_create_collection(chroma, kb_id, provider.dimension)

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

                # Update progress
                progress = min(int(stored / len(chunks) * 100), 100)
                task.current_chunk = stored
                task.progress = progress
                await db.commit()

                logger.info(f"Embedded batch {i // BATCH + 1}/{(len(chunks) + BATCH - 1) // BATCH}, doc={doc_id}, progress={stored}/{len(chunks)}")

            # Update document
            old_chunk_count = doc.chunk_count or 0
            doc.status = "completed"
            doc.chunk_count = len(chunks)
            doc.chunk_size = chunk_size
            doc.chunk_overlap = chunk_overlap
            doc.separators = separators
            kb = await db.get(KnowledgeBase, kb_id)
            if kb:
                kb.doc_count = (kb.doc_count or 0) - old_chunk_count + len(chunks)

            task.status = "completed"
            task.progress = 100
            await db.commit()

            logger.info(f"Chunked doc={doc_id}, chunks={len(chunks)}")

    except Exception as e:
        logger.error(f"Chunk task failed task={task_id} doc={doc_id}: {e}")
        async with factory() as db:
            task = await db.get(ChunkTask, task_id)
            if task:
                task.status = "failed"
                task.error_message = str(e)
                await db.commit()
            doc = await db.get(Document, doc_id)
            if doc:
                doc.status = "failed"
                doc.error_message = str(e)
                await db.commit()


@router.post("/documents/{doc_id}/chunk")
async def chunk_document(doc_id: str, req: ChunkRequest, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.kb_id != req.kb_id:
        raise HTTPException(status_code=400, detail="Document does not belong to this KB")
    if not doc.extracted_text:
        raise HTTPException(status_code=400, detail="Document has no extracted text")

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

    # Update doc status
    doc.status = "processing"
    doc.error_message = None
    await db.commit()

    # Create task record
    task_id = uuid.uuid4().hex[:16]
    task = ChunkTask(
        id=task_id,
        doc_id=doc_id,
        status="pending",
        progress=0,
        total_chunks=0,
        current_chunk=0,
    )
    db.add(task)
    await db.commit()

    # Launch background task
    asyncio.ensure_future(_run_chunk_task(task_id, doc_id, req.kb_id, chunk_size, chunk_overlap, separators))

    return {"task_id": task_id, "doc_id": doc_id, "status": "pending"}


@router.get("/documents/{doc_id}/chunk-progress", response_model=ChunkTaskResponse)
async def get_chunk_progress(doc_id: str, db: AsyncSession = Depends(get_db)):
    # Get the latest task for this doc
    result = await db.execute(
        select(ChunkTask)
        .where(ChunkTask.doc_id == doc_id)
        .order_by(ChunkTask.created_at.desc())
        .limit(1)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="No chunk task found for this document")

    return ChunkTaskResponse(
        task_id=task.id,
        doc_id=task.doc_id,
        status=task.status,
        progress=task.progress,
        total_chunks=task.total_chunks,
        current_chunk=task.current_chunk,
        error_message=task.error_message,
    )
