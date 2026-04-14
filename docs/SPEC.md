# CIFT - 知识库管理系统 项目规格说明

> CIFT: **C**ontext **I**ntelligence **F**ramework & **T**oolkit

## 1. 项目概述

一个简易版本的知识库管理系统，支持文件上传、解析、存储与语义检索。用户可以创建知识库、上传文档（txt/markdown），系统自动解析文档内容并生成向量嵌入，支持对知识库内容的语义搜索。

### 1.1 核心价值

- 简单易用的知识库管理界面
- 文档上传后自动解析与向量化
- 支持语义搜索，快速定位知识内容
- 容器化部署，一键启动

### 1.2 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 19 + TypeScript + Vite + Ant Design Pro | 主流 SPA 框架，生态成熟 ✅已搭建 |
| UI 组件库 | Ant Design 5 | 企业级 UI 组件，表格/表单/上传组件完善 |
| Node 服务 | Express + TypeScript | API 网关，处理用户请求、文件上传、业务编排 ✅已搭建 |
| Python 服务 | FastAPI | 文档解析、文本分块、向量嵌入生成 |
| 关系数据库 | PostgreSQL | 存储用户、知识库、文档元数据 |
| 向量数据库 | ChromaDB | 存储文档向量，支持相似度检索 |
| 对象存储 | MinIO (S3 兼容) | 存储上传的原始文件 |
| 容器编排 | Docker Compose | 统一管理所有服务 |

## 2. 系统架构

```
┌─────────────┐
│   Browser    │
└──────┬───────┘
       │ HTTP
       ▼
┌─────────────────┐
│  Nginx (反向代理) │ :80
└──┬──────────┬───┘
   │          │
   ▼          ▼
┌──────────┐ ┌────────────────┐
│ Frontend │ │  Node Service  │ :3000
│ (静态资源)│ │  (API Gateway) │
└──────────┘ └──┬─────────┬───┘
                │         │
         ┌──────┘         └──────┐
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Python Service  │    │    MinIO        │ :9000
│ (解析 & 向量化)  │    │  (文件存储)      │
└────────┬────────┘    └─────────────────┘
         │
    ┌────┴─────┐
    ▼          ▼
┌────────┐ ┌────────┐
│PostgreSQL│ │ChromaDB│
│ :5432   │ │:8001   │
└────────┘ └────────┘
```

### 2.1 服务职责划分

#### Node Service (API Gateway)

- 用户注册 / 登录 / 鉴权 (JWT)
- 知识库 CRUD
- 文件上传接口（接收文件 → 存 MinIO → 调 Python 服务解析）
- 文档管理（列表、删除、状态查询）
- 语义搜索接口（调 Python 服务检索）
- 静态前端资源托管（可选，也可由 Nginx 直接托管）

#### Python Service (解析 & 向量化)

- 文件内容提取（txt / markdown）
- 文本分块（chunking）——按段落 / 固定长度 + 重叠
- 向量嵌入生成（调用 Embedding API 或本地模型）
- 向量存储（写入 ChromaDB）
- 向量相似度检索

## 3. 数据模型

### 3.1 PostgreSQL 表结构

#### users 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| username | VARCHAR(64) UNIQUE | 用户名 |
| password_hash | VARCHAR(256) | 密码哈希 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### knowledge_bases 知识库表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| name | VARCHAR(128) | 知识库名称 |
| description | TEXT | 描述 |
| user_id | UUID (FK) | 所属用户 |
| doc_count | INTEGER DEFAULT 0 | 文档数量（冗余） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

#### documents 文档表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| kb_id | UUID (FK) | 所属知识库 |
| filename | VARCHAR(256) | 原始文件名 |
| file_type | VARCHAR(16) | 文件类型 (txt/md) |
| file_size | BIGINT | 文件大小 (bytes) |
| storage_key | VARCHAR(512) | MinIO 对象 key |
| status | VARCHAR(16) | 状态: uploading / parsing / completed / failed |
| chunk_count | INTEGER DEFAULT 0 | 分块数量 |
| error_message | TEXT | 错误信息 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 3.2 ChromaDB 向量存储

- Collection: 按 `kb_id` 命名，每个知识库一个 Collection
- 每条记录包含：
  - `id`: 与 document chunk 对应的唯一 ID
  - `embedding`: 向量数据
  - `metadata`: `{ doc_id, chunk_index, file_type }`
  - `document`: 原始文本分块内容

## 4. API 设计

### 4.1 认证相关

```
POST   /api/auth/register     注册
POST   /api/auth/login        登录 → 返回 JWT
GET    /api/auth/me           获取当前用户信息
```

### 4.2 知识库管理

```
GET    /api/kbs               获取用户的知识库列表
POST   /api/kbs               创建知识库
GET    /api/kbs/:kbId         获取知识库详情
PUT    /api/kbs/:kbId         更新知识库
DELETE /api/kbs/:kbId         删除知识库（含所有文档和向量）
```

### 4.3 文档管理

```
GET    /api/kbs/:kbId/documents           获取知识库下的文档列表
POST   /api/kbs/:kbId/documents/upload    上传文件 (multipart/form-data)
GET    /api/kbs/:kbId/documents/:docId    获取文档详情
DELETE /api/kbs/:kbId/documents/:docId    删除文档（含向量数据）
POST   /api/kbs/:kbId/documents/:docId/retry  重新解析失败的文档
```

### 4.4 搜索

```
POST   /api/kbs/:kbId/search   语义搜索
       body: { query: string, top_k?: number }
```

### 4.5 Python 服务内部接口 (Node → Python)

```
POST   /internal/parse           解析文件并生成向量
       body: { doc_id, storage_key, file_type, kb_id }
POST   /internal/search          向量检索
       body: { kb_id, query, top_k }
DELETE /internal/vectors/:kb_id  删除知识库所有向量
DELETE /internal/vectors/:kb_id/doc/:doc_id  删除文档向量
```

## 5. 前端页面

### 5.1 页面列表

| 页面 | 路由 | 说明 |
|------|------|------|
| 登录/注册 | /login | 用户认证 |
| 知识库列表 | / | 首页，展示所有知识库卡片 |
| 创建/编辑知识库 | /kb/new, /kb/:kbId/edit | 表单 |
| 知识库详情 | /kb/:kbId | 文档列表 + 上传 + 搜索 |
| 文档详情 | /kb/:kbId/doc/:docId | 文档内容预览 + 分块信息 |

### 5.2 核心交互

1. **文件上传**: 支持拖拽上传和点击上传，显示上传进度和解析状态（上传中 → 解析中 → 完成/失败）
2. **语义搜索**: 搜索框输入自然语言，返回相关文本片段，高亮显示来源文档
3. **文档状态流转**: 可视化展示文档处理状态，失败时可点击重试

## 6. 项目目录结构

```
cift/
├── docker-compose.yml
├── docs/
│   └── SPEC.md
├── frontend/                  # React + Vite + TypeScript
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/              # API 调用封装
│       ├── components/       # 通用组件
│       ├── pages/            # 页面组件
│       ├── hooks/            # 自定义 hooks
│       ├── store/            # 状态管理 (zustand)
│       ├── types/            # TypeScript 类型定义
│       └── utils/            # 工具函数
├── services/
│   ├── node/                 # Express + TypeScript
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/       # 路由定义
│   │       ├── middleware/    # 中间件 (auth, error handler)
│   │       ├── services/     # 业务逻辑
│   │       ├── models/       # 数据库模型 (Prisma)
│   │       └── utils/        # 工具函数
│   └── python/               # FastAPI
│       ├── Dockerfile
│       ├── requirements.txt
│       └── app/
│           ├── main.py
│           ├── routers/      # 路由
│           ├── services/     # 解析、分块、嵌入逻辑
│           ├── models/       # 数据模型 (Pydantic)
│           └── utils/        # 工具函数
├── infra/                    # 基础设施配置
│   ├── nginx/
│   │   └── nginx.conf
│   └── init-db.sql           # PostgreSQL 初始化脚本
└── scripts/                  # 开发/部署脚本
    └── dev.sh
```

## 7. Docker Compose 服务定义

```yaml
# docker-compose.yml (概要)
services:
  nginx:        # 反向代理 → 前端 + Node API
  frontend:     # React 构建产物
  node-service: # Express API Gateway
  python-service: # FastAPI 解析服务
  postgres:     # PostgreSQL
  chromadb:     # ChromaDB 向量数据库
  minio:        # MinIO 对象存储
```

## 8. 核心流程

### 8.1 文件上传与解析流程

```
用户上传文件
    │
    ▼
Node Service 接收文件
    │
    ├──→ 存储文件到 MinIO
    │
    ├──→ 创建 document 记录 (status: uploading)
    │
    ▼
Node Service 调用 Python Service /internal/parse
    │
    ▼
Python Service:
    ├── 从 MinIO 下载文件
    ├── 提取文本内容
    ├── 文本分块 (chunking)
    ├── 生成向量嵌入
    ├── 写入 ChromaDB
    └── 回调/返回结果给 Node Service
         │
         ▼
Node Service 更新 document 状态
    ├── 成功 → status: completed, chunk_count: N
    └── 失败 → status: failed, error_message: ...
```

### 8.2 语义搜索流程

```
用户输入查询文本
    │
    ▼
Node Service 接收请求
    │
    ▼
调用 Python Service /internal/search
    │
    ▼
Python Service:
    ├── 对查询文本生成向量嵌入
    ├── 在 ChromaDB 中检索相似向量
    └── 返回 top_k 结果 (含原文和元数据)
         │
         ▼
Node Service 返回结果给前端
```

## 9. 文本分块策略

### 9.1 初期实现

- **Markdown**: 按标题层级分块（`#` / `##` 拆分），每块不超过 1000 字符，重叠 200 字符
- **TXT**: 按固定长度分块，每块 800 字符，重叠 200 字符
- 分块时保留元数据：来源文档、分块索引、所属标题层级

### 9.2 后续扩展

- 支持更智能的分块策略（语义分块）
- 支持自定义分块参数（块大小、重叠长度）

## 10. 嵌入模型

系统采用 Provider 抽象层设计，通过 `EMBEDDING_PROVIDER` 环境变量切换不同的嵌入后端，无需修改业务代码。**默认使用 MLX-LM 本地模型**。

### 10.1 整体架构

```
┌────────────────────────────────────────┐
│         EmbeddingService (统一接口)      │
│  embed(texts: list[str]) → list[vec]   │
│  embed_query(text: str) → vec          │
└───────────────┬────────────────────────┘
                │ 根据 EMBEDDING_PROVIDER 路由
     ┌──────────┼──────────┬──────────────┐
     ▼          ▼          ▼              ▼
┌──────────┐ ┌────────┐ ┌────────┐  ┌─────────┐
│ MLX-LM   │ │ Ollama │ │llama.cpp│  │ OpenAI  │
│ Provider │ │Provider│ │Provider │  │Provider │
│ (默认)    │ │        │ │         │  │         │
└──────────┘ └────────┘ └────────┘  └─────────┘
```

Python Service 中定义统一基类：

```python
class BaseEmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]: ...

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]: ...

    @property
    @abstractmethod
    def dimension(self) -> int: ...
```

### 10.2 支持的 Provider

#### 10.2.1 MLX-LM (Apple Silicon 本地) — 默认

| 配置项 | 说明 |
|--------|------|
| `EMBEDDING_PROVIDER=mlx` | 启用 MLX-LM Provider（默认） |
| `MLX_MODEL_NAME` | HuggingFace 模型 ID 或本地路径，如 `mlx-community/bge-small-zh-v1.5-mlx` |
| `MLX_BATCH_SIZE` | 批处理大小，默认 32 |

- 适用场景：Apple Silicon (M1/M2/M3/M4) 芯片本地推理，利用统一内存架构
- Python 集成：`mlx-embeddings` 或通过 `mlx-lm` 库调用
- 推荐模型：
  - `mlx-community/bge-small-zh-v1.5-mlx` (512 维，中文轻量)
  - `mlx-community/bge-large-zh-v1.5-mlx` (1024 维，中文高质量)
  - `mlx-community/nomic-embed-text-v1.5-mlx` (768 维)
- 优势：充分利用 Apple GPU + 统一内存，推理速度快，无需额外 GPU 驱动
- 限制：仅适用于 Apple Silicon 的 macOS 环境，Docker 部署时需使用 `--platform linux/arm64` 并在 macOS 上运行

#### 10.2.2 Ollama (本地)

| 配置项 | 说明 |
|--------|------|
| `EMBEDDING_PROVIDER=ollama` | 启用 Ollama Provider |
| `OLLAMA_BASE_URL` | Ollama 服务地址，默认 `http://ollama:11434` |
| `EMBEDDING_MODEL` | 模型名，如 `nomic-embed-text`, `mxbai-embed-large` |

- 适用场景：本地部署，数据不出机器，支持多平台
- 推荐模型：
  - `nomic-embed-text` (768 维，英文为主，轻量)
  - `mxbai-embed-large` (1024 维，多语言)
  - `bge-m3` (1024 维，中文表现优秀)
- 使用方式：先通过 `ollama pull <model>` 拉取模型
- Docker Compose 中可添加 ollama 服务容器，也可连接宿主机已有实例

#### 10.2.3 llama.cpp (本地)

| 配置项 | 说明 |
|--------|------|
| `EMBEDDING_PROVIDER=llama_cpp` | 启用 llama.cpp Provider |
| `LLAMA_CPP_MODEL_PATH` | GGUF 模型文件路径（容器内或挂载路径） |
| `LLAMA_CPP_N_GPU_LAYERS` | GPU 层数，默认 -1（全部加载到 GPU） |
| `LLAMA_CPP_N_BATCH` | 批处理大小，默认 512 |

- 适用场景：高性能本地推理，支持 CUDA / Metal 加速
- Python 集成：`llama-cpp-python` 库，支持 `Llama.create_embedding()` 接口
- 模型格式：`.gguf`，需预先下载
- 推荐模型：
  - `bge-small-zh-v1.5` (512 维，中文轻量)
  - `bge-large-zh-v1.5` (1024 维，中文高质量)
  - `nomic-embed-text-v1.5` (768 维)
- 注意：需要根据部署环境（CPU/GPU）选择对应的 `llama-cpp-python` 安装版本

#### 10.2.4 OpenAI (云端)

| 配置项 | 说明 |
|--------|------|
| `EMBEDDING_PROVIDER=openai` | 启用 OpenAI Provider |
| `OPENAI_API_KEY` | API Key |
| `OPENAI_BASE_URL` | 可选，自定义 endpoint（兼容其他 OpenAI API 格式的服务） |
| `EMBEDDING_MODEL` | 模型名，默认 `text-embedding-3-small` |

- 适用场景：快速上手，无需本地 GPU
- 默认维度：1536 (text-embedding-3-small) / 3072 (text-embedding-3-large)
- 支持批量嵌入，单次最多 2048 条

### 10.3 Provider 选择指南

| Provider | 部署复杂度 | 中文支持 | 数据隐私 | 硬件要求 | 推荐场景 |
|----------|-----------|---------|---------|---------|---------|
| MLX-LM | 中 | 高 | 好 | Apple Silicon | Mac 本地开发（默认） |
| Ollama | 中 | 高 | 好 | 需要内存 ≥ 4GB | 本地开发、通用部署 |
| llama.cpp | 高 | 高 | 好 | CPU 可跑，GPU 更快 | 高性能推理、生产部署 |
| OpenAI | 低 | 中 | 数据经过云端 | 无 | 快速验证、无 GPU 环境 |

### 10.4 维度兼容性

- 每个 ChromaDB Collection 在创建时绑定固定的向量维度
- **切换 Provider 或模型时需注意维度是否一致**，维度不匹配会导致检索失败
- 建议在同一知识库内保持使用相同的嵌入模型
- 后续可在前端展示当前使用的嵌入模型和维度信息，切换模型时给出警告

### 10.5 Python Service 目录结构补充

```
services/python/app/
├── services/
│   ├── embedding/
│   │   ├── __init__.py
│   │   ├── base.py            # BaseEmbeddingProvider 抽象基类
│   │   ├── factory.py         # Provider 工厂，根据配置实例化
│   │   ├── mlx_provider.py    # MLX-LM (默认)
│   │   ├── ollama_provider.py
│   │   ├── llama_cpp_provider.py
│   │   └── openai_provider.py
│   └── ...
```

## 11. 非功能性需求

- **认证**: JWT Token，过期时间 24h，支持 Refresh Token
- **密码安全**: bcrypt 哈希，salt rounds = 10
- **文件大小限制**: 单文件最大 10MB
- **并发**: 初期不考虑高并发，单实例部署
- **日志**: 结构化日志，输出到 stdout（容器标准输出）
- **错误处理**: 统一错误响应格式 `{ code, message, details? }`
- **CORS**: 开发环境允许 localhost，生产环境通过 Nginx 同源代理

## 12. 开发阶段规划

### Phase 1 - 基础骨架 (MVP)

- [x] 项目脚手架搭建（Docker Compose + 各服务骨架）
- [x] 数据库初始化（PostgreSQL schema）
- [x] Node Service: 用户认证（JWT）+ 知识库 CRUD + 文件上传代理 + 搜索转发
- [x] Python Service: TXT/Markdown 解析 + 分块 + 嵌入（支持 MLX/Ollama/llama.cpp/OpenAI）
- [x] 前端: Ant Design Pro 风格布局 + 登录页 + 知识库管理 + 文件上传 + 语义搜索
- [x] Docker Compose 全链路联调

**Phase 1 已完成 ✅ (2026-04-14)**

### Phase 2 - 体验优化

- [ ] 文档内容预览
- [ ] 批量上传
- [ ] 搜索结果高亮与跳转
- [ ] 解析进度实时推送 (WebSocket)

### Phase 3 - 格式扩展

- [ ] PDF 解析
- [ ] Word (.docx) 解析
- [ ] 更多格式支持

## 13. 环境变量

```env
# 通用
NODE_ENV=development

# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=cift
POSTGRES_USER=cift
POSTGRES_PASSWORD=cift_dev_123

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=cift-files

# ChromaDB
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# JWT
JWT_SECRET=your-secret-key-change-in-prod
JWT_EXPIRES_IN=24h

# Embedding
EMBEDDING_PROVIDER=mlx              # mlx (默认) | ollama | llama_cpp | openai

# MLX-LM (默认 Provider)
MLX_MODEL_NAME=mlx-community/bge-small-zh-v1.5-mlx
MLX_BATCH_SIZE=32

# Ollama (当 EMBEDDING_PROVIDER=ollama 时生效)
OLLAMA_BASE_URL=http://ollama:11434
# EMBEDDING_MODEL=nomic-embed-text

# llama.cpp (当 EMBEDDING_PROVIDER=llama_cpp 时生效)
# LLAMA_CPP_MODEL_PATH=/models/bge-small-zh-v1.5.gguf
# LLAMA_CPP_N_GPU_LAYERS=-1
# LLAMA_CPP_N_BATCH=512

# OpenAI (当 EMBEDDING_PROVIDER=openai 时生效)
# OPENAI_API_KEY=sk-xxx
# OPENAI_BASE_URL=
# EMBEDDING_MODEL=text-embedding-3-small

# Python Service
PYTHON_SERVICE_URL=http://python-service:8000
```
