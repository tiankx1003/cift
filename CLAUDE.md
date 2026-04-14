# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CIFT (Context Intelligence Framework & Toolkit) — a knowledge base management system supporting file upload, parsing, vector embedding, and semantic search. Currently in Phase 1 (MVP) development.

## Architecture

Four services orchestrated via Docker Compose:

- **frontend/** — React 19 + TypeScript + Vite + Ant Design Pro (ProLayout)
- **services/node/** — Express + TypeScript API Gateway (auth, KB CRUD, file upload, search orchestration)
- **services/python/** — FastAPI service (document parsing, text chunking, vector embedding, similarity search) **scaffolded and running**
- **infra/** — Nginx config, DB init scripts *(not yet scaffolded)*

Storage: PostgreSQL (metadata) | ChromaDB (vectors) | MinIO (raw files)

## Python Service (`services/python/`)

Dependency management via **uv** (`pyproject.toml` + `uv.lock`). Python ≥ 3.11.

```
services/python/
├── pyproject.toml
├── uv.lock
└── app/
    ├── main.py                      # FastAPI entry, lifespan ensures MinIO bucket
    ├── models/schemas.py            # Pydantic request/response models
    ├── routers/
    │   ├── parse.py                 # POST /internal/parse (MinIO) & /internal/parse-direct (bypass MinIO)
    │   ├── search.py                # POST /internal/search
    │   └── vectors.py               # DELETE /internal/vectors/{kb_id}[/doc/{doc_id}]
    ├── services/
    │   ├── embedding/               # Provider abstraction
    │   │   ├── base.py              #   BaseEmbeddingProvider ABC
    │   │   ├── factory.py           #   create_embedding_provider(settings)
    │   │   ├── mlx_provider.py      #   Apple Silicon (default in production)
    │   │   ├── ollama_provider.py
    │   │   ├── llama_cpp_provider.py
    │   │   ├── openai_provider.py
    │   │   └── dummy_provider.py    #   Hash-based vectors for testing
    │   ├── parser/                  # txt_parser, markdown_parser
    │   ├── chunker.py               # TextChunker (fixed-size), MarkdownChunker (heading-split)
    │   ├── chroma_client.py         # HttpClient when chroma_host set, else PersistentClient
    │   └── minio_client.py          # download_file, ensure_bucket
    └── utils/
        ├── config.py                # pydantic-settings, all config from env vars
        └── logger.py                # structured stdout logger
```

### Embedding System

Provider abstraction in `services/python/app/services/embedding/`. Factory pattern via `EMBEDDING_PROVIDER` env var.

Providers: `mlx` (default, Apple Silicon) | `ollama` | `llama_cpp` | `openai` | `dummy` (testing)

### Current Defaults (local dev without Docker)

`EMBEDDING_PROVIDER=dummy`, `chroma_host=""` (uses PersistentClient at `./chroma_data`). These are set in `app/utils/config.py` defaults, not in `.env`. Change `embedding_provider` back to `"mlx"` for production.

### Parse Pipeline

`parse router` → download from MinIO (or direct content via `parse-direct`) → parser extracts text → chunker splits → embedding provider generates vectors → write to ChromaDB collection (one per kb_id).

## Key Conventions

- Node ↔ Python communication uses `/internal/*` routes (not exposed to frontend)
- Each knowledge base maps to one ChromaDB collection; vector dimension is fixed per collection
- Document status flow: `uploading → parsing → completed | failed`
- JWT auth on all `/api/*` routes except login/register
- File size limit: 10MB; supported formats: txt, md (Phase 1)
- All imports inside Python service use **absolute** form: `from app.xxx import ...`

## Common Commands

```bash
# Python service (from services/python/)
uv sync                      # install dependencies
uv sync --extra mlx          # also install MLX provider
uv sync --extra dev          # also install pytest etc.
uvicorn app.main:app --reload   # dev server on :8000
uv run pytest                   # run tests

# Docker (from project root, once fully scaffolded)
docker compose up --build          # start all services
docker compose logs -f <service>   # tail logs

# Frontend (from frontend/)
npm run dev                        # Vite dev server
npm run build                      # production build

# Node service (from services/node/)
npm run dev                        # dev with hot reload
npm run build                      # compile TypeScript
```

## Spec

Full project specification lives in `docs/SPEC.md`.
