# CIFT

**Context Intelligence Framework & Toolkit** — 一个轻量级知识库管理系统，支持文件上传、文本解析、向量嵌入和语义搜索。

## 功能特性

- 文件上传（支持 `.txt`、`.md`，multipart/form-data）
- 文档解析与文本分块（Markdown 按标题拆分，纯文本固定窗口）
- 向量嵌入（支持 Ollama、OpenAI、MLX、llama.cpp 等多种 Provider）
- 语义搜索（基于向量相似度，返回匹配片段与置信度）
- 知识库管理（创建、查看、删除）
- 文档管理（上传、列表、删除）
- Docker Compose 一键部署

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19、TypeScript、Vite、Ant Design 5 |
| 后端 | Python 3.12、FastAPI、SQLAlchemy 2.0 (async) |
| 向量数据库 | ChromaDB |
| 元数据存储 | PostgreSQL 16 |
| 对象存储 | MinIO |
| 容器编排 | Docker Compose |
| 嵌入模型 | Ollama (bge-small-zh-v1.5) |

## 快速开始

### 前置条件

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- 本地运行的 [Ollama](https://ollama.ai)（用于 embedding 生成）

拉取 Ollama 模型：

```bash
ollama pull qllama/bge-small-zh-v1.5
```

### 一键部署

```bash
# 复制配置文件
cp .env.example .env

# 根据实际环境修改 .env 中的 OLLAMA_BASE_URL
# macOS Docker Desktop 默认可用 host.docker.internal 访问宿主机

# 构建并启动
docker compose up --build

# 后台运行
docker compose up --build -d
```

启动后访问：

| 服务 | 地址 |
|---|---|
| 前端 UI | http://localhost |
| Python API | http://localhost:8000 |
| MinIO 控制台 | http://localhost:9001 |

### 停止服务

```bash
docker compose down          # 停止容器，保留数据
docker compose down -v       # 停止容器并清除数据卷
```

## 本地开发

不需要 Docker，直接启动各服务。

### 1. 启动 PostgreSQL

```bash
docker run -d --name cift-pg \
  -e POSTGRES_USER=cift \
  -e POSTGRES_PASSWORD=cift_dev_123 \
  -e POSTGRES_DB=cift \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. 启动后端

```bash
cd services/python

# 安装依赖（首次）
uv sync

# 启动开发服务器
uv run uvicorn app.main:app --reload --port 8000
```

后端默认使用嵌入式 ChromaDB（`./chroma_data`），Ollama 指向 `localhost:11434`。

### 3. 启动前端

```bash
cd frontend

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev
```

前端开发服务器（http://localhost:5173）自动将 `/internal/*` 请求代理到后端 `:8000`。

## 项目结构

```
cift/
├── docker-compose.yml              # 容器编排
├── .env.example                    # 环境变量模板
├── docs/
│   ├── SPEC.md                     # 完整产品设计文档
│   └── PROGRESS.md                 # 开发进度
├── frontend/                       # React 前端
│   ├── Dockerfile                  # 多阶段构建（build → nginx）
│   ├── nginx.conf                  # Nginx 反向代理配置
│   ├── src/
│   │   ├── api.ts                  # API 客户端
│   │   ├── App.tsx                 # 路由入口
│   │   └── pages/
│   │       ├── Home.tsx            # 知识库列表
│   │       └── KbDetail.tsx        # 知识库详情（上传/搜索）
│   └── ...
├── services/
│   └── python/                     # FastAPI 后端
│       ├── Dockerfile
│       ├── pyproject.toml
│       └── app/
│           ├── main.py             # FastAPI 入口 + lifespan
│           ├── models/
│           │   └── schemas.py      # Pydantic 请求/响应模型
│           ├── routers/
│           │   ├── kbs.py          # 知识库 CRUD
│           │   ├── upload.py       # 文件上传
│           │   ├── search.py       # 语义搜索
│           │   ├── vectors.py      # 向量删除
│           │   └── parse.py        # 解析接口
│           ├── services/
│           │   ├── database.py     # SQLAlchemy ORM (PostgreSQL)
│           │   ├── chroma_client.py    # ChromaDB 客户端
│           │   ├── minio_client.py     # MinIO 客户端
│           │   ├── chunker.py      # 文本分块
│           │   ├── embedding/      # 向量嵌入 Provider 抽象
│           │   │   ├── ollama_provider.py
│           │   │   ├── openai_provider.py
│           │   │   ├── mlx_provider.py
│           │   │   └── ...
│           │   └── parser/         # 文档解析
│           │       ├── txt_parser.py
│           │       └── markdown_parser.py
│           └── utils/
│               ├── config.py       # pydantic-settings 配置
│               └── logger.py       # 结构化日志
└── CLAUDE.md                       # Claude Code 开发指引
```

## API 接口

所有接口前缀为 `/internal`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/kbs` | 列出所有知识库 |
| POST | `/kbs` | 创建知识库 |
| GET | `/kbs/{kb_id}` | 获取知识库详情 |
| DELETE | `/kbs/{kb_id}` | 删除知识库 |
| GET | `/kbs/{kb_id}/documents` | 列出知识库下的文档 |
| POST | `/upload` | 上传文件（multipart/form-data） |
| POST | `/search` | 语义搜索 |
| DELETE | `/vectors/{kb_id}` | 删除知识库全部向量 |
| DELETE | `/vectors/{kb_id}/doc/{doc_id}` | 删除指定文档向量 |

## 配置说明

通过 `.env` 文件或环境变量配置，完整模板见 `.env.example`。

### PostgreSQL

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `POSTGRES_HOST` | `postgres` | PostgreSQL 主机（Docker 内部） |
| `POSTGRES_PORT` | `5432` | 端口 |
| `POSTGRES_DB` | `cift` | 数据库名 |
| `POSTGRES_USER` | `cift` | 用户名 |
| `POSTGRES_PASSWORD` | `cift_dev_123` | 密码 |
| `DATABASE_URL` | — | SQLAlchemy 连接串（自动拼接） |

### Embedding

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `EMBEDDING_PROVIDER` | `ollama` | 嵌入 Provider：`ollama` / `openai` / `mlx` / `llama_cpp` / `dummy` |
| `EMBEDDING_MODEL` | `qllama/bge-small-zh-v1.5` | 模型名称 |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 地址 |
| `OPENAI_API_KEY` | — | OpenAI API Key |
| `OPENAI_BASE_URL` | — | OpenAI 兼容 API 地址 |

### ChromaDB & MinIO

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CHROMA_HOST` | `chromadb` | ChromaDB 主机（空值则使用嵌入式模式） |
| `CHROMA_PORT` | `8000` | ChromaDB 端口 |
| `MINIO_ENDPOINT` | `minio:9000` | MinIO 地址 |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO Access Key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO Secret Key |
| `MINIO_BUCKET` | `cift-files` | 存储桶名称 |

## License

MIT
