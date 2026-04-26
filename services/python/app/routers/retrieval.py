from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import DifyRetrievalRequest, DifyRetrievalResponse, DifyRecord
from ..services import (
    get_chroma_client,
    create_embedding_provider,
    get_db,
    Document,
)
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["retrieval"])


@router.post("/retrieval", response_model=DifyRetrievalResponse)
async def dify_retrieval(req: DifyRetrievalRequest, db: AsyncSession = Depends(get_db)):
    """Dify-compatible retrieval endpoint."""
    settings = get_settings()
    kb_id = req.knowledge_id
    top_k = req.retrieval_setting.top_k
    score_threshold = req.retrieval_setting.score_threshold

    try:
        # 1. Embed the query
        provider = create_embedding_provider(settings)
        query_embedding = await provider.embed_query(req.query)

        # 2. Search ChromaDB
        chroma = get_chroma_client(settings)
        try:
            collection = chroma.get_collection(kb_id)
        except Exception:
            raise HTTPException(status_code=400, detail={
                "error_code": 2001,
                "error_msg": f"Knowledge base not found: {kb_id}",
            })

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        # 3. Collect doc_ids and fetch filenames
        doc_ids = set()
        if results["metadatas"] and results["metadatas"][0]:
            for meta in results["metadatas"][0]:
                if "doc_id" in meta:
                    doc_ids.add(meta["doc_id"])

        filename_map: dict[str, str] = {}
        if doc_ids:
            rows = await db.execute(select(Document.id, Document.filename).where(Document.id.in_(doc_ids)))
            for row in rows:
                filename_map[row[0]] = row[1]

        # 4. Format results
        records: list[DifyRecord] = []
        if results["ids"] and results["ids"][0]:
            for i, chunk_id in enumerate(results["ids"][0]):
                distance = results["distances"][0][i]
                similarity = max(0, 1 - distance)
                if similarity < score_threshold:
                    continue
                meta = dict(results["metadatas"][0][i]) if results["metadatas"][0][i] else {}
                doc_id = meta.get("doc_id", "")
                title = filename_map.get(doc_id, doc_id)
                chunk_index = meta.get("chunk_index", 0)
                records.append(DifyRecord(
                    content=results["documents"][0][i],
                    score=round(similarity, 4),
                    title=title,
                    metadata={
                        "source": title,
                        "chunk_index": chunk_index,
                        "doc_id": doc_id,
                    },
                ))

        return DifyRetrievalResponse(records=records)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Retrieval failed kb={kb_id}: {e}")
        raise HTTPException(status_code=500, detail={
            "error_code": 5001,
            "error_msg": str(e),
        })
