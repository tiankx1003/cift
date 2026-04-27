import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import (
    ChatSessionCreate, ChatSessionInfo, ChatMessageInfo, ChatRequest,
)
from ..services import (
    get_db, get_chroma_client, create_embedding_provider,
    ChatSession, ChatMessage, ModelConfig, PromptTemplate,
)
from ..services.llm.factory import create_llm_client_from_config
from ..models.schemas import ModelConfigInfo
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal/chat", tags=["chat"])

DEFAULT_SYSTEM_PROMPT = """你是一个知识库问答助手。根据以下检索到的上下文内容回答用户的问题。
如果上下文中没有相关信息，请如实说明。回答时请引用来源。"""

DEFAULT_RAG_TEMPLATE = """## 参考内容
{context}

## 用户问题
{question}"""


# --- Session CRUD ---

@router.post("/sessions", response_model=ChatSessionInfo)
async def create_session(req: ChatSessionCreate, db: AsyncSession = Depends(get_db)):
    session_id = uuid.uuid4().hex[:32]
    session = ChatSession(id=session_id, kb_id=req.kb_id, title=req.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ChatSessionInfo(
        id=session.id, kb_id=session.kb_id, title=session.title,
        created_at=session.created_at.isoformat() if session.created_at else None,
        updated_at=session.updated_at.isoformat() if session.updated_at else None,
    )


@router.get("/sessions", response_model=list[ChatSessionInfo])
async def list_sessions(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.kb_id == kb_id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [
        ChatSessionInfo(
            id=s.id, kb_id=s.kb_id, title=s.title,
            created_at=s.created_at.isoformat() if s.created_at else None,
            updated_at=s.updated_at.isoformat() if s.updated_at else None,
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageInfo])
async def get_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        ChatMessageInfo(
            id=m.id, session_id=m.session_id, role=m.role,
            content=m.content, sources=m.sources,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
        for m in messages
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"status": "ok"}


# --- Chat Stream ---

@router.post("/sessions/{session_id}/stream")
async def stream_chat(session_id: str, req: ChatRequest, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 1. Save user message
    user_msg = ChatMessage(
        id=uuid.uuid4().hex[:32],
        session_id=session_id,
        role="user",
        content=req.query,
    )
    db.add(user_msg)

    # Update session title if first message
    msg_count = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
    )
    if len(msg_count.scalars().all()) == 0:
        session.title = req.query[:50]

    await db.commit()

    # 2. Load history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    history = history_result.scalars().all()

    # 3. Vector search for context
    settings = get_settings()
    contexts: list[dict] = []
    try:
        provider = create_embedding_provider(settings)
        query_embedding = await provider.embed_query(req.query)

        chroma = get_chroma_client(settings)
        collection = chroma.get_collection(session.kb_id)
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
                contexts.append({
                    "chunk_id": chunk_id,
                    "content": results["documents"][0][i],
                    "score": similarity,
                    "metadata": meta,
                })
    except Exception as e:
        logger.warning(f"Chat search failed: {e}")

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
    else:
        # Try loading default template for this KB
        default_tmpl = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.kb_id == session.kb_id,
                PromptTemplate.is_default == True,
            ).limit(1)
        )
        tmpl = default_tmpl.scalar_one_or_none()
        if tmpl:
            if tmpl.system_prompt:
                system_prompt = tmpl.system_prompt
            if tmpl.rag_template:
                rag_template = tmpl.rag_template

    # 5. Build messages for LLM
    context_text = "\n\n".join(
        f"[{i+1}] {c['content']}" for i, c in enumerate(contexts)
    )
    rag_content = rag_template.replace("{context}", context_text).replace("{question}", req.query)

    llm_messages = [{"role": "system", "content": f"{system_prompt}\n\n{rag_content}"}]
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
            assistant_msg = ChatMessage(
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
            logger.error(f"Chat stream error: {e}")
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
