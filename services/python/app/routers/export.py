import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..services import get_chroma_client, get_db, KnowledgeBase, Document
from ..utils import get_settings

router = APIRouter(prefix="/internal/kbs", tags=["export"])


@router.get("/{kb_id}/export")
async def export_kb(kb_id: str, format: str = "json", db: AsyncSession = Depends(get_db)):
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail=f"Knowledge base '{kb_id}' not found")

    # Get all documents for filename lookup
    result = await db.execute(
        select(Document).where(Document.kb_id == kb_id)
    )
    docs = result.scalars().all()
    doc_map = {d.id: d.filename for d in docs}

    # Get all chunks from ChromaDB
    settings = get_settings()
    chroma = get_chroma_client(settings)
    try:
        collection = chroma.get_collection(kb_id)
    except Exception:
        raise HTTPException(status_code=404, detail="No vector data found for this knowledge base")

    data = collection.get(include=["documents", "metadatas"])

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["chunk_id", "content", "document_name", "chunk_index"])
        for i, chunk_id in enumerate(data["ids"]):
            content = data["documents"][i] if data["documents"] else ""
            meta = data["metadatas"][i] if data["metadatas"] else {}
            doc_id = meta.get("doc_id", "")
            chunk_index = meta.get("chunk_index", "")
            doc_name = doc_map.get(doc_id, doc_id)
            writer.writerow([chunk_id, content, doc_name, chunk_index])
        output.seek(0)

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={kb.name}_chunks.csv"},
        )
    else:
        # JSON format
        chunks = []
        for i, chunk_id in enumerate(data["ids"]):
            content = data["documents"][i] if data["documents"] else ""
            meta = data["metadatas"][i] if data["metadatas"] else {}
            doc_id = meta.get("doc_id", "")
            doc_name = doc_map.get(doc_id, doc_id)
            chunks.append({
                "chunk_id": chunk_id,
                "content": content,
                "document_name": doc_name,
                "chunk_index": meta.get("chunk_index"),
                "metadata": meta,
            })

        content = json.dumps(chunks, ensure_ascii=False, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={kb.name}_chunks.json"},
        )
