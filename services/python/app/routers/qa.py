import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import (
    QaSessionCreate, QaSessionRename, QaSessionInfo, QaMessageInfo, QaRequest,
    ModelConfigInfo,
)
from ..services import (
    get_db, get_chroma_client, create_embedding_provider,
    QaSession, QaMessage, ModelConfig, PromptTemplate,
)
from ..services.llm.factory import create_llm_client_from_config
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal/qa", tags=["qa"])

DEFAULT_SYSTEM_PROMPT = """你是一个智能问答助手。根据以下检索到的上下文内容回答用户的问题。
如果上下文中没有相关信息，请如实说明。回答时请引用来源。"""

DEFAULT_RAG_TEMPLATE = """## 参考内容
{context}

## 用户问题
{question}"""

PURE_LLM_SYSTEM_PROMPT = """你是一个智能问答助手，请根据你的知识回答用户的问题。"""


# --- Session CRUD ---

@router.post("/sessions", response_model=QaSessionInfo)
async def create_session(
    req: QaSessionCreate,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    session_id = uuid.uuid4().hex[:32]
    session = QaSession(id=session_id, user_id=user_id, title=req.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return QaSessionInfo(
        id=session.id, user_id=session.user_id, title=session.title,
        created_at=session.created_at.isoformat() if session.created_at else None,
        updated_at=session.updated_at.isoformat() if session.updated_at else None,
    )


@router.get("/sessions", response_model=list[QaSessionInfo])
async def list_sessions(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(QaSession)
        .where(QaSession.user_id == user_id)
        .order_by(QaSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [
        QaSessionInfo(
            id=s.id, user_id=s.user_id, title=s.title,
            created_at=s.created_at.isoformat() if s.created_at else None,
            updated_at=s.updated_at.isoformat() if s.updated_at else None,
        )
        for s in sessions
    ]


@router.patch("/sessions/{session_id}", response_model=QaSessionInfo)
async def rename_session(
    session_id: str,
    req: QaSessionRename,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(QaSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = req.title
    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    return QaSessionInfo(
        id=session.id, user_id=session.user_id, title=session.title,
        created_at=session.created_at.isoformat() if session.created_at else None,
        updated_at=session.updated_at.isoformat() if session.updated_at else None,
    )


@router.get("/sessions/{session_id}/messages", response_model=list[QaMessageInfo])
async def get_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(QaMessage)
        .where(QaMessage.session_id == session_id)
        .order_by(QaMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        QaMessageInfo(
            id=m.id, session_id=m.session_id, role=m.role,
            content=m.content, kb_ids=m.kb_ids, sources=m.sources,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
        for m in messages
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(QaSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"status": "ok"}


# --- QA Stream ---

@router.post("/sessions/{session_id}/stream")
async def stream_qa(
    session_id: str,
    req: QaRequest,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(QaSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 1. Save user message
    user_msg = QaMessage(
        id=uuid.uuid4().hex[:32],
        session_id=session_id,
        role="user",
        content=req.query,
        kb_ids=json.dumps(req.kb_ids) if req.kb_ids else None,
    )
    db.add(user_msg)

    # Update session title if first message
    msg_count = await db.execute(
        select(QaMessage).where(QaMessage.session_id == session_id)
    )
    if len(msg_count.scalars().all()) == 0:
        session.title = req.query[:50]

    await db.commit()

    # 2. Load history
    history_result = await db.execute(
        select(QaMessage)
        .where(QaMessage.session_id == session_id)
        .order_by(QaMessage.created_at.asc())
    )
    history = history_result.scalars().all()

    # 3. Multi-KB retrieval
    settings = get_settings()
    contexts: list[dict] = []

    if req.kb_ids:
        try:
            provider = create_embedding_provider(settings)
            query_embedding = await provider.embed_query(req.query)
            chroma = get_chroma_client(settings)

            for kb_id in req.kb_ids:
                try:
                    collection = chroma.get_collection(kb_id)
                    results = collection.query(
                        query_embeddings=[query_embedding],
                        n_results=req.top_k,
                        include=["documents", "metadatas", "distances"],
                    )
                    if results["ids"] and results["ids"][0]:
                        for i, chunk_id in enumerate(results["ids"][0]):
                            distance = results["distances"][0][i]
                            similarity = max(0, 1 - distance)
                            if similarity < req.similarity_threshold:
                                continue
                            meta = dict(results["metadatas"][0][i]) if results["metadatas"][0][i] else {}
                            meta["kb_id"] = kb_id
                            contexts.append({
                                "chunk_id": chunk_id,
                                "content": results["documents"][0][i],
                                "score": similarity,
                                "metadata": meta,
                            })
                except Exception as e:
                    logger.warning(f"QA search failed for kb {kb_id}: {e}")

            # Sort by score desc and take top_k
            contexts.sort(key=lambda x: x["score"], reverse=True)
            contexts = contexts[:req.top_k]

        except Exception as e:
            logger.warning(f"QA retrieval failed: {e}")

    # 4. Load prompt template
    system_prompt = DEFAULT_SYSTEM_PROMPT
    rag_template = DEFAULT_RAG_TEMPLATE

    if req.template_id:
        tmpl = await db.get(PromptTemplate, req.template_id)
        if tmpl:
            if tmpl.system_prompt:
                system_prompt = tmpl.system_prompt
            if tmpl.rag_template:
                rag_template = tmpl.rag_template
    elif not contexts:
        system_prompt = PURE_LLM_SYSTEM_PROMPT

    # 5. Build messages for LLM
    if contexts:
        context_text = "\n\n".join(
            f"[{i+1}] {c['content']}" for i, c in enumerate(contexts)
        )
        rag_content = rag_template.replace("{context}", context_text).replace("{question}", req.query)
        llm_messages = [{"role": "system", "content": f"{system_prompt}\n\n{rag_content}"}]
    else:
        llm_messages = [{"role": "system", "content": system_prompt}]

    for msg in history:
        llm_messages.append({"role": msg.role, "content": msg.content})

    # 6. Get active LLM
    active_llm = await db.execute(
        select(ModelConfig).where(
            ModelConfig.model_type == "llm",
            ModelConfig.is_active == True,
        ).limit(1)
    )
    llm_model = active_llm.scalar_one_or_none()
    if not llm_model:
        raise HTTPException(status_code=400, detail="No active LLM model configured")

    config_info = ModelConfigInfo(
        id=llm_model.id, model_type=llm_model.model_type,
        provider=llm_model.provider, model_name=llm_model.model_name,
        base_url=llm_model.base_url, api_key=llm_model.api_key,
        is_active=llm_model.is_active, extra_params=llm_model.extra_params,
    )

    llm_client = create_llm_client_from_config(config_info)

    # 7. Stream response
    async def generate():
        full_content = []
        try:
            async for token in llm_client.chat_stream(llm_messages):
                full_content.append(token)
                event = json.dumps({"type": "token", "content": token}, ensure_ascii=False)
                yield f"data: {event}\n\n"

            # Send sources
            sources = json.dumps(
                [{"chunk_id": c["chunk_id"], "content": c["content"][:200], "score": c["score"], "metadata": c["metadata"]} for c in contexts],
                ensure_ascii=False,
            )
            yield f"data: {json.dumps({'type': 'sources', 'citations': sources}, ensure_ascii=False)}\n\n"

            # Save assistant message
            assistant_msg = QaMessage(
                id=uuid.uuid4().hex[:32],
                session_id=session_id,
                role="assistant",
                content="".join(full_content),
                sources=sources if contexts else None,
            )
            db.add(assistant_msg)
            session.updated_at = datetime.utcnow()
            await db.commit()

        except Exception as e:
            logger.error(f"QA stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
