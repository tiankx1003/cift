from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..services import get_db, Document
from ..models.schemas import DocumentPreviewResponse

router = APIRouter(prefix="/internal/documents", tags=["documents"])


@router.get("/{doc_id}/preview", response_model=DocumentPreviewResponse)
async def preview_document(doc_id: str, kb_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc or doc.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentPreviewResponse(
        content=doc.extracted_text or "",
        file_type=doc.file_type,
        filename=doc.filename,
    )
