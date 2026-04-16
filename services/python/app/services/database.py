from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, String, Text, Integer, BigInteger, ForeignKey, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.utils.config import get_settings


class Base(DeclarativeBase):
    pass


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    doc_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    documents: Mapped[list["Document"]] = relationship(back_populates="kb", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    kb_id: Mapped[str] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String(256))
    file_type: Mapped[str] = mapped_column(String(16))
    file_size: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(16), default="parsing")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    kb: Mapped["KnowledgeBase"] = relationship(back_populates="documents")


class ChunkConfig(Base):
    __tablename__ = "chunk_configs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    kb_id: Mapped[str] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    chunk_size: Mapped[int] = mapped_column(Integer, default=800)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=200)
    separators: Mapped[str] = mapped_column(Text, default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class ModelConfig(Base):
    __tablename__ = "model_configs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), index=True)
    model_type: Mapped[str] = mapped_column(String(16))  # "llm" | "embedding" | "rerank"
    provider: Mapped[str] = mapped_column(String(32))     # "ollama" | "openai" | "mlx" | "llama_cpp"
    model_name: Mapped[str] = mapped_column(String(128))
    base_url: Mapped[str] = mapped_column(String(512), default="")
    api_key: Mapped[str] = mapped_column(String(256), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    extra_params: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeGraph(Base):
    __tablename__ = "knowledge_graphs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    kb_id: Mapped[str] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    node_count: Mapped[int] = mapped_column(Integer, default=0)
    edge_count: Mapped[int] = mapped_column(Integer, default=0)
    graph_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)


_engine = None
_session_factory = None


def _get_engine():
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(settings.database_url, echo=False)
        _session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    return _engine, _session_factory


async def init_db():
    engine, _ = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    _, factory = _get_engine()
    async with factory() as session:
        yield session
