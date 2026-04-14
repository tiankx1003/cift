# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CIFT (Context Intelligence Framework & Toolkit) — a knowledge base management system supporting file upload, parsing, vector embedding, and semantic search. Phase 1 (MVP) is feature-complete.

## Architecture

Six services orchestrated via Docker Compose behind a top-level Nginx reverse proxy:

- **frontend/** — React 19 + TypeScript + Vite + Ant Design 6 + ProLayout
- **services/node/** — Express + TypeScript API Gateway (JWT auth, KB CRUD, file upload proxy, search proxy)
- **services/python/** — FastAPI service (document parsing, text chunking, vector embedding, similarity search)
- **infra/nginx/** — Top-level Nginx config (`/api/*` → node-service, `/` → frontend)
- **postgres** — Metadata storage (users, knowledge_bases, documents)
- **chromadb** / **minio** — Vector storage / raw file storage

Request flow: `Browser → Nginx:80 → /api/* → Node:3000 → Python:8000`
                                    `→ /*    → Frontend (static)`

## Node Service (`services/node/`)

Express + TypeScript API Gateway. Dependencies via npm. `tsx` for dev, `tsc` for build.

Key modules:
- `src/routes/auth.ts` — Register, login (`POST /api/auth/*`), `getMe`
- `src/routes/knowledgeBases.ts` — KB CRUD, queries PostgreSQL directly for ownership
- `src/routes/documents.ts` — Upload forwards file to Python `/internal/upload`, list/delete proxies to Python
- `src/routes/search.ts` — Search proxy to Python
- `src/middleware/auth.ts` — JWT Bearer token verification
- `src/services/pythonClient.ts` — HTTP client to Python service (`/internal/*` routes)
- `src/services/minioClient.ts` — MinIO bucket management (ensureBucket)

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
    │   ├── kbs.py                   # KB CRUD + document listing (GET /internal/kbs)
    │   ├── upload.py                # POST /internal/upload (full pipeline)
    │   ├── parse.py                 # POST /internal/parse (MinIO) & /internal/parse-direct
    │   ├── search.py                # POST /internal/search
    │   └── vectors.py               # DELETE /internal/vectors/{kb_id}[/doc/{doc_id}]
    ├── services/
    │   ├── database.py              # SQLAlchemy ORM models (KnowledgeBase, Document)
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

### Upload Pipeline (Node → Python)

`Node receives file` → `Node forwards to Python POST /internal/upload` → Python creates Document record in PostgreSQL → stores file in MinIO → parses text → chunks → embeds → stores vectors in ChromaDB → updates `kb.doc_count`.

## Frontend (`frontend/`)

React 19 + Ant Design 6 + ProLayout (v3 beta for antd 6 compat).

- `src/api.ts` — API client, base URL `/api`, auto JWT injection, 401 → `/login`
- `src/utils/auth.ts` — Token management (localStorage, key: `cift_token`)
- `src/components/BasicLayout.tsx` — ProLayout shell with auth guard
- `src/pages/Login.tsx` — Login/register with Tabs, gradient background
- `src/pages/Home.tsx` — KB list with stats cards, color-coded cards
- `src/pages/KbDetail.tsx` — File upload, document table, semantic search with progress bars

## Key Conventions

- Node ↔ Python communication uses `/internal/*` routes (not exposed to frontend)
- Frontend ↔ Node uses `/api/*` routes with JWT Bearer token
- Each knowledge base maps to one ChromaDB collection; vector dimension is fixed per collection
- Document status flow: `uploading → parsing → completed | failed`
- JWT auth on all `/api/*` routes except `/api/auth/login` and `/api/auth/register`
- File size limit: 10MB; supported formats: txt, md (Phase 1)
- All imports inside Python service use **absolute** form: `from app.xxx import ...`
- All imports inside Node service use **relative with .js extension**: `from './config.js'`

## Common Commands

```bash
# Docker (from project root)
docker compose up --build          # start all services
docker compose down -v             # stop and clear data
docker compose logs -f <service>   # tail logs

# Frontend (from frontend/)
npm run dev                        # Vite dev server (proxies /api → :3000)
npm run build                      # production build

# Node service (from services/node/)
npm run dev                        # dev with tsx watch
npm run build                      # compile TypeScript

# Python service (from services/python/)
uv sync                            # install dependencies
uv sync --extra mlx                # also install MLX provider
uv run uvicorn app.main:app --reload  # dev server on :8000
```

## Spec

Full project specification lives in `docs/SPEC.md`.
