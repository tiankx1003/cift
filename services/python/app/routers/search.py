from fastapi import APIRouter, HTTPException

from ..models import SearchRequest, SearchResponse, SearchResult
from ..services import (
    get_chroma_client,
    get_or_create_collection,
    create_embedding_provider,
)
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
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

        # 3. Format results
        search_results = []
        if results["ids"] and results["ids"][0]:
            for i, chunk_id in enumerate(results["ids"][0]):
                score = results["distances"][0][i]
                # Convert distance to similarity (1 - distance for cosine)
                similarity = max(0, 1 - score)
                search_results.append(
                    SearchResult(
                        chunk_id=chunk_id,
                        content=results["documents"][0][i],
                        score=similarity,
                        metadata=results["metadatas"][0][i],
                    )
                )

        return SearchResponse(results=search_results)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed kb={req.kb_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
