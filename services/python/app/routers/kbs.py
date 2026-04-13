import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import CreateKbRequest, KbInfo, DocumentInfo
from ..services import get_chroma_client, get_or_create_collection, get_db, KnowledgeBase, Document
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal/kbs", tags=["knowledge-bases"])


@router.get("", response_model=list[KbInfo])
async def list_kbs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeBase).order_by(KnowledgeBase.created_at.desc())
    )
    kbs = result.scalars().all()
    return [
        KbInfo(kb_id=kb.id, name=kb.name, description=kb.description, doc_count=kb.doc_count)
        for kb in kbs
    ]


@router.post("", response_model=KbInfo)
async def create_kb(req: CreateKbRequest, db: AsyncSession = Depends(get_db)):
    kb_id = uuid.uuid4().hex[:12]
    kb = KnowledgeBase(id=kb_id, name=req.name, description=req.description)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    # Create ChromaDB collection for vectors
    settings = get_settings()
    chroma = get_chroma_client(settings)
    get_or_create_collection(chroma, kb_id, 0)
    return KbInfo(kb_id=kb.id, name=kb.name, description=kb.description, doc_count=0)


@router.get("/{kb_id}", response_model=KbInfo)
async def get_kb(kb_id: str, db: AsyncSession = Depends(get_db)):
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail=f"Knowledge base '{kb_id}' not found")
    return KbInfo(kb_id=kb.id, name=kb.name, description=kb.description, doc_count=kb.doc_count)


@router.delete("/{kb_id}")
async def delete_kb(kb_id: str, db: AsyncSession = Depends(get_db)):
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail=f"Knowledge base '{kb_id}' not found")
    await db.delete(kb)
    await db.commit()
    # Delete ChromaDB collection
    settings = get_settings()
    chroma = get_chroma_client(settings)
    try:
        chroma.delete_collection(kb_id)
    except Exception:
        pass
    logger.info(f"Deleted KB: {kb_id}")
    return {"status": "ok", "kb_id": kb_id}


@router.get("/{kb_id}/documents", response_model=list[DocumentInfo])
async def list_documents(kb_id: str, db: AsyncSession = Depends(get_db)):
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail=f"Knowledge base '{kb_id}' not found")
    result = await db.execute(
        select(Document).where(Document.kb_id == kb_id).order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        DocumentInfo(
            doc_id=d.id, filename=d.filename, file_type=d.file_type,
            file_size=d.file_size, status=d.status, chunk_count=d.chunk_count,
        )
        for d in docs
    ]
