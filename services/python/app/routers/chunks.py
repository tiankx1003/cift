from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import ChunkInfo, ChunksResponse
from ..services.chroma_client import get_chroma_client
from ..services.database import get_db, Document
from ..utils import get_settings, logger

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

router = APIRouter(prefix="/internal", tags=["chunks"])


@router.get("/documents/{doc_id}/chunks", response_model=ChunksResponse)
async def get_document_chunks(doc_id: str, kb_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    settings = get_settings()

    try:
        # Get extracted text from document
        doc = await db.get(Document, doc_id)
        extracted_text = doc.extracted_text if doc else ""

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

                start_offset = metadata.get("start_offset")
                end_offset = metadata.get("end_offset")

                # Fallback: search for chunk content in extracted text
                if (start_offset is None or end_offset is None) and extracted_text:
                    idx = extracted_text.find(content)
                    if idx != -1:
                        start_offset = idx
                        end_offset = idx + len(content)

                chunks.append(
                    ChunkInfo(
                        chunk_index=metadata.get("chunk_index", i),
                        content=content,
                        char_count=len(content),
                        start_offset=start_offset,
                        end_offset=end_offset,
                    )
                )

        chunks.sort(key=lambda c: c.chunk_index)

        return ChunksResponse(
            extracted_text=extracted_text or "",
            chunks=chunks,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get chunks failed doc={doc_id} kb={kb_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
