from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import SearchRequest, SearchResponse, SearchResult
from ..services import (
    get_chroma_client,
    create_embedding_provider,
    get_db,
    Document,
    ModelConfig,
)
from ..services.bm25 import BM25Index
from ..services.rerank.factory import create_rerank_provider_from_config
from ..models.schemas import ModelConfigInfo
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    search_mode = req.search_mode or "vector"

    try:
        chroma = get_chroma_client(settings)
        try:
            collection = chroma.get_collection(req.kb_id)
        except Exception:
            raise HTTPException(status_code=404, detail=f"Collection not found: {req.kb_id}")

        # --- Step 1: Vector search (for vector/hybrid modes) ---
        vector_results: list[SearchResult] = []
        if search_mode in ("vector", "hybrid"):
            provider = create_embedding_provider(settings)
            query_embedding = await provider.embed_query(req.query)

            # Over-fetch for rerank
            fetch_k = req.top_k * 3 if req.use_rerank else req.top_k
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=fetch_k,
                include=["documents", "metadatas", "distances"],
            )

            if results["ids"] and results["ids"][0]:
                for i, chunk_id in enumerate(results["ids"][0]):
                    distance = results["distances"][0][i]
                    similarity = max(0, 1 - distance)
                    meta = dict(results["metadatas"][0][i]) if results["metadatas"][0][i] else {}
                    vector_results.append(
                        SearchResult(
                            chunk_id=chunk_id,
                            content=results["documents"][0][i],
                            score=similarity,
                            metadata=meta,
                        )
                    )

        # --- Step 2: BM25 search (for bm25/hybrid modes) ---
        bm25_results: list[dict] = []  # [{index, score, chunk_id, content, metadata}]
        if search_mode in ("bm25", "hybrid"):
            all_data = collection.get(include=["documents", "metadatas"])
            if all_data["ids"]:
                corpus = all_data["documents"] or []
                bm25 = BM25Index()
                bm25.build(corpus)
                bm25_hits = bm25.search(req.query, top_k=req.top_k * 3)

                for hit in bm25_hits:
                    idx = hit["index"]
                    meta = dict(all_data["metadatas"][idx]) if all_data["metadatas"] else {}
                    bm25_results.append({
                        "chunk_id": all_data["ids"][idx],
                        "content": corpus[idx],
                        "bm25_score": hit["score"],
                        "metadata": meta,
                    })

        # --- Step 3: Merge results ---
        search_results: list[SearchResult] = []

        if search_mode == "vector":
            search_results = vector_results

        elif search_mode == "bm25":
            # Pure BM25 — normalize scores to 0-1
            if bm25_results:
                scores = [r["bm25_score"] for r in bm25_results]
                min_s, max_s = min(scores), max(scores)
                range_s = max_s - min_s if max_s > min_s else 1.0
                for r in bm25_results:
                    normalized = (r["bm25_score"] - min_s) / range_s
                    if normalized < req.similarity_threshold:
                        continue
                    search_results.append(SearchResult(
                        chunk_id=r["chunk_id"],
                        content=r["content"],
                        score=normalized,
                        metadata=r["metadata"],
                        bm25_score=normalized,
                    ))

        elif search_mode == "hybrid":
            # Weighted fusion: final = vw * vector_score + (1 - vw) * normalized_bm25
            vw = req.vector_weight

            # Build lookup maps
            vector_map = {r.chunk_id: r for r in vector_results}
            bm25_map: dict[str, dict] = {}
            if bm25_results:
                scores = [r["bm25_score"] for r in bm25_results]
                min_s, max_s = min(scores), max(scores)
                range_s = max_s - min_s if max_s > min_s else 1.0
                for r in bm25_results:
                    r["normalized_bm25"] = (r["bm25_score"] - min_s) / range_s
                    bm25_map[r["chunk_id"]] = r

            # Merge all chunk_ids
            all_ids = set(vector_map.keys()) | set(bm25_map.keys())
            merged: list[SearchResult] = []
            for cid in all_ids:
                vs = vector_map[cid].score if cid in vector_map else 0.0
                content = vector_map[cid].content if cid in vector_map else bm25_map[cid]["content"]
                meta = vector_map[cid].metadata if cid in vector_map else bm25_map[cid]["metadata"]
                bs = bm25_map[cid].get("normalized_bm25", 0.0) if cid in bm25_map else 0.0
                norm_bm25 = bm25_map[cid].get("normalized_bm25") if cid in bm25_map else None

                final_score = vw * vs + (1 - vw) * bs
                if final_score < req.similarity_threshold:
                    continue

                merged.append(SearchResult(
                    chunk_id=cid,
                    content=content,
                    score=final_score,
                    metadata=meta,
                    bm25_score=norm_bm25,
                    vector_score=vs if cid in vector_map else None,
                ))

            merged.sort(key=lambda x: x.score, reverse=True)
            search_results = merged[:req.top_k]

        # --- Step 4: Apply similarity threshold for vector mode ---
        if search_mode == "vector":
            search_results = [r for r in search_results if r.score >= req.similarity_threshold]

        # --- Step 5: Rerank (if enabled and rerank model exists) ---
        if req.use_rerank and search_results:
            try:
                active_rerank = await db.execute(
                    select(ModelConfig).where(
                        ModelConfig.model_type == "rerank",
                        ModelConfig.is_active == True,
                    ).limit(1)
                )
                rerank_model = active_rerank.scalar_one_or_none()
                if rerank_model:
                    config_info = ModelConfigInfo(
                        id=rerank_model.id,
                        model_type=rerank_model.model_type,
                        provider=rerank_model.provider,
                        model_name=rerank_model.model_name,
                        base_url=rerank_model.base_url,
                        api_key=rerank_model.api_key,
                        is_active=rerank_model.is_active,
                        extra_params=rerank_model.extra_params,
                    )
                    rerank_provider = create_rerank_provider_from_config(config_info)
                    docs = [r.content for r in search_results]
                    rerank_hits = await rerank_provider.rerank(req.query, docs, top_k=req.top_k)

                    # Reorder by rerank score
                    reranked = []
                    for hit in rerank_hits:
                        idx = hit["index"]
                        if idx < len(search_results):
                            r = search_results[idx]
                            reranked.append(SearchResult(
                                chunk_id=r.chunk_id,
                                content=r.content,
                                score=r.score,
                                metadata=r.metadata,
                                rerank_score=hit["score"],
                            ))
                    search_results = reranked
            except Exception as e:
                logger.warning(f"Rerank failed, using vector results: {e}")

        # --- Step 6: Enrich metadata with filenames ---
        doc_ids = set()
        for r in search_results:
            did = r.metadata.get("doc_id", "")
            if did:
                doc_ids.add(did)

        filename_map: dict[str, str] = {}
        if doc_ids:
            rows = await db.execute(select(Document.id, Document.filename).where(Document.id.in_(doc_ids)))
            for row in rows:
                filename_map[row[0]] = row[1]

        for r in search_results:
            did = r.metadata.get("doc_id", "")
            if did and did in filename_map:
                r.metadata["filename"] = filename_map[did]

        # Limit to top_k
        search_results = search_results[:req.top_k]

        return SearchResponse(results=search_results)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed kb={req.kb_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
