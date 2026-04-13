from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..services import get_chroma_client, get_db, KnowledgeBase, Document
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal/vectors", tags=["vectors"])


@router.delete("/{kb_id}")
async def delete_kb_vectors(kb_id: str, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    try:
        chroma = get_chroma_client(settings)
        chroma.delete_collection(kb_id)
        logger.info(f"Deleted collection: {kb_id}")
        return {"status": "ok", "kb_id": kb_id}
    except Exception as e:
        logger.error(f"Delete collection failed kb={kb_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{kb_id}/doc/{doc_id}")
async def delete_doc_vectors(
    kb_id: str, doc_id: str, db: AsyncSession = Depends(get_db)
):
    settings = get_settings()
    try:
        # Delete from ChromaDB
        chroma = get_chroma_client(settings)
        collection = chroma.get_collection(kb_id)
        collection.delete(where={"doc_id": doc_id})

        # Delete from PostgreSQL
        doc = await db.get(Document, doc_id)
        if doc:
            await db.delete(doc)
            kb = await db.get(KnowledgeBase, kb_id)
            if kb and kb.doc_count > 0:
                kb.doc_count -= 1
            await db.commit()

        logger.info(f"Deleted vectors for doc={doc_id} in kb={kb_id}")
        return {"status": "ok", "kb_id": kb_id, "doc_id": doc_id}
    except Exception as e:
        logger.error(f"Delete doc vectors failed kb={kb_id} doc={doc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
