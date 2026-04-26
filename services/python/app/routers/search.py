from fastapi import APIRouter, Depends, HTTPException

from ..models import SearchRequest, SearchResponse, SearchResult
from ..services import (
    get_chroma_client,
    get_or_create_collection,
    create_embedding_provider,
    get_db,
    Document,
)
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, db=Depends(get_db)):
    settings = get_settings()

    try:
        # 1. Embed the query
        provider = create_embedding_provider(settings)
        query_embedding = await provider.embed_query(req.query)

        # 2. Search ChromaDB
        chroma = get_chroma_client(settings)
        try:
            collection = chroma.get_collection(req.kb_id)
        except Exception:
            raise HTTPException(status_code=404, detail=f"Collection not found: {req.kb_id}")

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=req.top_k,
            include=["documents", "metadatas", "distances"],
        )

        # 3. Collect doc_ids and batch-fetch filenames
        doc_ids = set()
        if results["metadatas"] and results["metadatas"][0]:
            for meta in results["metadatas"][0]:
                if "doc_id" in meta:
                    doc_ids.add(meta["doc_id"])

        filename_map: dict[str, str] = {}
        if doc_ids:
            from sqlalchemy import select
            rows = await db.execute(select(Document.id, Document.filename).where(Document.id.in_(doc_ids)))
            for row in rows:
                filename_map[row[0]] = row[1]

        # 4. Format results — apply similarity threshold
        search_results = []
        if results["ids"] and results["ids"][0]:
            for i, chunk_id in enumerate(results["ids"][0]):
                score = results["distances"][0][i]
                # Convert distance to similarity (1 - distance for cosine)
                similarity = max(0, 1 - score)
                if similarity < req.similarity_threshold:
                    continue
                meta = dict(results["metadatas"][0][i]) if results["metadatas"][0][i] else {}
                # Enrich metadata with filename
                doc_id = meta.get("doc_id", "")
                if doc_id and doc_id in filename_map:
                    meta["filename"] = filename_map[doc_id]
                search_results.append(
                    SearchResult(
                        chunk_id=chunk_id,
                        content=results["documents"][0][i],
                        score=similarity,
                        metadata=meta,
                    )
                )

        return SearchResponse(results=search_results)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed kb={req.kb_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
