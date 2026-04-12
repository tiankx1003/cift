from fastapi import APIRouter, HTTPException

from ..models import VectorDeleteRequest
from ..services import get_chroma_client
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal/vectors", tags=["vectors"])


@router.delete("/{kb_id}")
async def delete_kb_vectors(kb_id: str):
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
async def delete_doc_vectors(kb_id: str, doc_id: str):
    settings = get_settings()
    try:
        chroma = get_chroma_client(settings)
        collection = chroma.get_collection(kb_id)
        # Delete by metadata filter
        collection.delete(where={"doc_id": doc_id})
        logger.info(f"Deleted vectors for doc={doc_id} in kb={kb_id}")
        return {"status": "ok", "kb_id": kb_id, "doc_id": doc_id}
    except Exception as e:
        logger.error(f"Delete doc vectors failed kb={kb_id} doc={doc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
