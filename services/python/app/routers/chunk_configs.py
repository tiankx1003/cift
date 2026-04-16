import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schemas import ChunkConfigCreate, ChunkConfigUpdate, ChunkConfigInfo
from ..services import get_db, ChunkConfig
from ..utils import logger

router = APIRouter(prefix="/internal/kbs/{kb_id}/chunk-configs", tags=["chunk-configs"])


@router.get("", response_model=list[ChunkConfigInfo])
async def list_chunk_configs(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChunkConfig).where(ChunkConfig.kb_id == kb_id).order_by(ChunkConfig.created_at)
    )
    configs = result.scalars().all()
    return [ChunkConfigInfo(
        id=c.id, name=c.name, chunk_size=c.chunk_size,
        chunk_overlap=c.chunk_overlap, separators=c.separators, is_default=c.is_default,
    ) for c in configs]


@router.post("", response_model=ChunkConfigInfo)
async def create_chunk_config(kb_id: str, data: ChunkConfigCreate, db: AsyncSession = Depends(get_db)):
    config = ChunkConfig(
        id=uuid.uuid4().hex[:16],
        kb_id=kb_id,
        name=data.name,
        chunk_size=data.chunk_size,
        chunk_overlap=data.chunk_overlap,
        separators=data.separators,
        is_default=False,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return ChunkConfigInfo(
        id=config.id, name=config.name, chunk_size=config.chunk_size,
        chunk_overlap=config.chunk_overlap, separators=config.separators, is_default=config.is_default,
    )


@router.put("/{config_id}", response_model=ChunkConfigInfo)
async def update_chunk_config(kb_id: str, config_id: str, data: ChunkConfigUpdate, db: AsyncSession = Depends(get_db)):
    config = await db.get(ChunkConfig, config_id)
    if not config or config.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="Config not found")

    if data.name is not None:
        config.name = data.name
    if data.chunk_size is not None:
        config.chunk_size = data.chunk_size
    if data.chunk_overlap is not None:
        config.chunk_overlap = data.chunk_overlap
    if data.separators is not None:
        config.separators = data.separators

    await db.commit()
    await db.refresh(config)
    return ChunkConfigInfo(
        id=config.id, name=config.name, chunk_size=config.chunk_size,
        chunk_overlap=config.chunk_overlap, separators=config.separators, is_default=config.is_default,
    )


@router.delete("/{config_id}")
async def delete_chunk_config(kb_id: str, config_id: str, db: AsyncSession = Depends(get_db)):
    config = await db.get(ChunkConfig, config_id)
    if not config or config.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="Config not found")
    await db.delete(config)
    await db.commit()
    return {"status": "ok"}


@router.put("/{config_id}/default", response_model=ChunkConfigInfo)
async def set_default_chunk_config(kb_id: str, config_id: str, db: AsyncSession = Depends(get_db)):
    config = await db.get(ChunkConfig, config_id)
    if not config or config.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="Config not found")

    # Clear all defaults for this KB
    await db.execute(
        update(ChunkConfig).where(ChunkConfig.kb_id == kb_id).values(is_default=False)
    )
    config.is_default = True
    await db.commit()
    await db.refresh(config)
    return ChunkConfigInfo(
        id=config.id, name=config.name, chunk_size=config.chunk_size,
        chunk_overlap=config.chunk_overlap, separators=config.separators, is_default=config.is_default,
    )
