from contextlib import asynccontextmanager

from fastapi import FastAPI

from .routers import parse_router, search_router, vectors_router
from .services import ensure_bucket, get_minio_client
from .utils import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure MinIO bucket exists
    try:
        client = get_minio_client()
        ensure_bucket(client)
        logger.info("MinIO bucket ensured")
    except Exception as e:
        logger.warning(f"MinIO not available at startup: {e}")
    yield


app = FastAPI(title="CIFT Python Service", version="0.1.0", lifespan=lifespan)

app.include_router(parse_router)
app.include_router(search_router)
app.include_router(vectors_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
