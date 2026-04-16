from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import ChunkInfo, ChunksResponse
from ..services.chroma_client import get_chroma_client
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["chunks"])


@router.get("/documents/{doc_id}/chunks", response_model=ChunksResponse)
async def get_document_chunks(doc_id: str, kb_id: str = Query(...)):
    settings = get_settings()

    try:
        chroma = get_chroma_client(settings)
        try:
            collection = chroma.get_collection(kb_id)
        except Exception:
            raise HTTPException(status_code=404, detail=f"Collection not found: {kb_id}")

        results = collection.get(
            where={"doc_id": doc_id},
            include=["documents", "metadatas"],
        )

        chunks = []
        if results["ids"]:
            for i, _id in enumerate(results["ids"]):
                metadata = results["metadatas"][i]
                content = results["documents"][i]
                chunks.append(
                    ChunkInfo(
                        chunk_index=metadata.get("chunk_index", i),
                        content=content,
                        char_count=len(content),
                    )
                )

        chunks.sort(key=lambda c: c.chunk_index)

        return ChunksResponse(chunks=chunks)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get chunks failed doc={doc_id} kb={kb_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
