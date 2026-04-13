import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import UploadResponse
from ..services import (
    get_minio_client,
    upload_file as minio_upload,
    get_parser,
    make_chunks,
    get_chroma_client,
    get_or_create_collection,
    create_embedding_provider,
    get_db,
    KnowledgeBase,
    Document,
)
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal", tags=["upload"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".txt", ".md"}
MIME_MAP = {".txt": "text/plain", ".md": "text/markdown"}


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    kb_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate KB exists
    kb = await db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail=f"Knowledge base '{kb_id}' not found")

    filename = file.filename or "unknown"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # --- validate file ---
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(file_bytes)} bytes). Max: {MAX_FILE_SIZE} bytes",
        )

    doc_id = uuid.uuid4().hex
    file_type = ext.lstrip(".")
    storage_key = f"{kb_id}/{doc_id}/{filename}"
    settings = get_settings()

    # Create document record
    doc = Document(
        id=doc_id, kb_id=kb_id, filename=filename,
        file_type=file_type, file_size=len(file_bytes),
        storage_key=storage_key, status="parsing",
    )
    db.add(doc)
    await db.commit()

    # --- upload to MinIO ---
    try:
        minio = get_minio_client(settings)
        minio_upload(minio, storage_key, file_bytes, MIME_MAP[ext])
    except Exception as e:
        logger.warning(f"MinIO upload skipped: {e}")

    # --- parse → chunk → embed → store ---
    try:
        parser = get_parser(file_type)
        text = parser.parse(file_bytes)

        if not text.strip():
            doc.status = "completed"
            doc.chunk_count = 0
            await db.commit()
            return UploadResponse(
                doc_id=doc_id, kb_id=kb_id, filename=filename,
                file_type=file_type, file_size=len(file_bytes),
                storage_key=storage_key, status="completed", chunk_count=0,
            )

        chunks = make_chunks(text, file_type)
        provider = create_embedding_provider(settings)
        texts = [c["content"] for c in chunks]
        embeddings = await provider.embed(texts)

        chroma = get_chroma_client(settings)
        collection = get_or_create_collection(chroma, kb_id, provider.dimension)
        collection.add(
            ids=[c["id"] for c in chunks],
            embeddings=embeddings,
            documents=texts,
            metadatas=[
                {"doc_id": doc_id, "chunk_index": c["metadata"]["chunk_index"]}
                for c in chunks
            ],
        )

        # Update document record
        doc.status = "completed"
        doc.chunk_count = len(chunks)
        kb.doc_count = kb.doc_count + 1
        await db.commit()

        logger.info(f"Uploaded doc={doc_id}, chunks={len(chunks)}")
        return UploadResponse(
            doc_id=doc_id, kb_id=kb_id, filename=filename,
            file_type=file_type, file_size=len(file_bytes),
            storage_key=storage_key, status="completed", chunk_count=len(chunks),
        )
    except Exception as e:
        logger.error(f"Upload parse failed doc={doc_id}: {e}")
        doc.status = "failed"
        doc.error_message = str(e)
        await db.commit()
        return UploadResponse(
            doc_id=doc_id, kb_id=kb_id, filename=filename,
            file_type=file_type, file_size=len(file_bytes),
            storage_key=storage_key, status="failed", error_message=str(e),
        )
