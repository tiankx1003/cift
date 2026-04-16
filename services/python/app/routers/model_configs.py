import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import ModelConfigCreate, ModelConfigUpdate, ModelConfigInfo
from ..services import get_db, ModelConfig
from ..services.embedding.factory import create_embedding_provider
from ..utils import get_settings, logger

router = APIRouter(prefix="/internal/models", tags=["models"])


def _mask_api_key(key: str) -> str:
    if not key or len(key) <= 8:
        return key
    return key[:4] + "****" + key[-4:]


def _to_info(m: ModelConfig) -> ModelConfigInfo:
    return ModelConfigInfo(
        id=m.id,
        model_type=m.model_type,
        provider=m.provider,
        model_name=m.model_name,
        base_url=m.base_url,
        api_key=_mask_api_key(m.api_key),
        is_active=m.is_active,
        extra_params=m.extra_params,
    )


@router.get("")
async def list_models(type: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    stmt = select(ModelConfig)
    if type:
        stmt = stmt.where(ModelConfig.model_type == type)
    result = await db.execute(stmt.order_by(ModelConfig.created_at))
    return [_to_info(m) for m in result.scalars().all()]


@router.get("/active")
async def get_active_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelConfig).where(ModelConfig.is_active == True))
    return [_to_info(m) for m in result.scalars().all()]


@router.post("", response_model=ModelConfigInfo)
async def create_model(data: ModelConfigCreate, db: AsyncSession = Depends(get_db)):
    config = ModelConfig(
        id=uuid.uuid4().hex[:16],
        user_id="*",  # MVP: shared for now; node gateway handles user isolation
        model_type=data.model_type,
        provider=data.provider,
        model_name=data.model_name,
        base_url=data.base_url,
        api_key=data.api_key,
        is_active=False,
        extra_params=data.extra_params,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return _to_info(config)


@router.put("/{config_id}", response_model=ModelConfigInfo)
async def update_model(config_id: str, data: ModelConfigUpdate, db: AsyncSession = Depends(get_db)):
    config = await db.get(ModelConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model config not found")
    if data.provider is not None:
        config.provider = data.provider
    if data.model_name is not None:
        config.model_name = data.model_name
    if data.base_url is not None:
        config.base_url = data.base_url
    if data.api_key is not None:
        config.api_key = data.api_key
    if data.extra_params is not None:
        config.extra_params = data.extra_params
    await db.commit()
    await db.refresh(config)
    return _to_info(config)


@router.delete("/{config_id}")
async def delete_model(config_id: str, db: AsyncSession = Depends(get_db)):
    config = await db.get(ModelConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model config not found")
    await db.delete(config)
    await db.commit()
    return {"status": "ok"}


@router.put("/{config_id}/activate", response_model=ModelConfigInfo)
async def activate_model(config_id: str, db: AsyncSession = Depends(get_db)):
    config = await db.get(ModelConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model config not found")
    # Deactivate others of same type
    await db.execute(
        update(ModelConfig).where(ModelConfig.model_type == config.model_type).values(is_active=False)
    )
    config.is_active = True
    await db.commit()
    await db.refresh(config)
    return _to_info(config)


@router.post("/test")
async def test_model(data: ModelConfigCreate, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    try:
        if data.model_type == "embedding":
            from ..services.embedding.factory import create_embedding_provider
            # Temporarily create provider with the given config
            if data.provider == "ollama":
                from ..services.embedding.ollama_provider import OllamaProvider
                provider = OllamaProvider(model=data.model_name, base_url=data.base_url or "http://localhost:11434")
            elif data.provider == "openai":
                from ..services.embedding.openai_provider import OpenAIProvider
                provider = OpenAIProvider(model=data.model_name, api_key=data.api_key, base_url=data.base_url or "")
            elif data.provider == "dummy":
                from ..services.embedding.dummy_provider import DummyProvider
                provider = DummyProvider()
            else:
                return {"success": False, "message": f"Embedding provider '{data.provider}' test not supported"}
            dim = provider.dimension
            return {"success": True, "message": f"连接成功，向量维度: {dim}"}

        elif data.model_type == "llm":
            import httpx
            base_url = (data.base_url or "http://localhost:11434").rstrip("/")
            headers = {"Content-Type": "application/json"}
            if data.api_key:
                headers["Authorization"] = f"Bearer {data.api_key}"
            payload = {
                "model": data.model_name,
                "messages": [{"role": "user", "content": "Hi"}],
                "max_tokens": 10,
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{base_url}/v1/chat/completions", headers=headers, json=payload, timeout=30)
                resp.raise_for_status()
            return {"success": True, "message": "LLM 连接成功"}

        elif data.model_type == "rerank":
            return {"success": True, "message": "Rerank 配置已保存（暂无在线测试）"}

        else:
            return {"success": False, "message": f"Unknown model type: {data.model_type}"}

    except Exception as e:
        return {"success": False, "message": str(e)}
