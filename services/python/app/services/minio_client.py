from __future__ import annotations

from io import BytesIO

from minio import Minio

from app.utils.config import Settings, get_settings


def get_minio_client(settings: Settings | None = None) -> Minio:
    settings = settings or get_settings()
    return Minio(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def ensure_bucket(client: Minio, bucket: str | None = None) -> None:
    settings = get_settings()
    bucket = bucket or settings.minio_bucket
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def download_file(client: Minio, storage_key: str, bucket: str | None = None) -> bytes:
    settings = get_settings()
    bucket = bucket or settings.minio_bucket
    resp = client.get_object(bucket, storage_key)
    data = resp.read()
    resp.close()
    resp.release_conn()
    return data
