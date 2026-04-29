from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import parse_router, search_router, vectors_router, upload_router, kbs_router, chunks_router, chunking_router, chunk_configs_router, model_configs_router, knowledge_graphs_router, retrieval_router, export_router, documents_router, chat_router, prompts_router, qa_router
from .services import ensure_bucket, get_minio_client, init_db
from .utils import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create PostgreSQL tables
    try:
        await init_db()
        logger.info("Database tables ensured")
    except Exception as e:
        logger.warning(f"Database init failed: {e}")
    # Startup: ensure MinIO bucket exists
    try:
        client = get_minio_client()
        ensure_bucket(client)
        logger.info("MinIO bucket ensured")
    except Exception as e:
        logger.warning(f"MinIO not available at startup: {e}")
    yield


app = FastAPI(title="CIFT Python Service", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_router)
app.include_router(search_router)
app.include_router(vectors_router)
app.include_router(upload_router)
app.include_router(kbs_router)
app.include_router(chunks_router)
app.include_router(chunking_router)
app.include_router(chunk_configs_router)
app.include_router(model_configs_router)
app.include_router(knowledge_graphs_router)
app.include_router(retrieval_router)
app.include_router(export_router)
app.include_router(documents_router)
app.include_router(chat_router)
app.include_router(prompts_router)
app.include_router(qa_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
