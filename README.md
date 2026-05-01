# CIFT

**Context Intelligence Framework & Toolkit** — 轻量级知识库管理系统，支持文件上传解析、智能分段、多模式检索和 RAG 对话。

## 功能特性

### 文档管理
- 多格式文件上传（`.txt`、`.md`、`.pdf`、`.docx`、`.csv`、`.json`）
- 文档在线预览
- 智能分段（固定长度 / 按标题章节结构化）+ 自定义分隔符
- 分段配置保存与复用
- 分块原文对照预览（左右分栏，高亮对应区域）
- Chunk 数据导出（JSON / CSV）

### 检索能力
- 语义搜索（向量相似度，关键词高亮）
- 关键词搜索（BM25）
- 混合检索（向量 + BM25 加权融合）
- Rerank 重排序（可配置 Rerank 模型，自动降级）
- 可调搜索参数（top-k、相似度阈值、向量权重）

### RAG 对话
- 多轮对话，SSE 流式逐字输出
- 自动检索相关上下文 + LLM 生成回答
- 引用来源标注（chunk + 来源文档）
- Prompt 模板管理（按知识库隔离，支持变量 `{context}`、`{question}`）

### 智能问答
- 独立对话模块，不绑定知识库
- 多知识库检索：同时选择多个 KB，合并排序取 top_k
- 纯 LLM 模式：不选知识库时直接回答
- 会话管理（新建/重命名/删除）

### 召回测试
- 独立检索调试页面（`/kb/:kbId/recall`）
- 左侧固定参数面板 + 右侧分页结果
- 参数支持拖动和手动输入（top-k、相似度阈值、向量权重）
- 混合检索分别展示混合/语义/关键词三项分数

### 系统管理
- 用户注册 / 登录（JWT 认证）
- 知识库管理（创建、查看、删除）+ 统计面板
- 模型管理（LLM / Embedding / Rerank 配置与连接测试）
- API Key 管理（支持 `Bearer` 和 `X-API-Key` 两种方式）
- Dify 兼容检索接口
- Swagger API 文档（`/api/docs`）
- 知识图谱（LLM 实体抽取 + 可视化）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19、TypeScript、Vite、Ant Design 6、ProLayout |
| API 网关 | Node.js 22、Express、TypeScript、JWT |
| 后端 | Python 3.12+、FastAPI、SQLAlchemy 2.0 (async)、NetworkX |
| 关系数据库 | PostgreSQL 16 |
| 向量数据库 | ChromaDB |
| 对象存储 | MinIO |
| 反向代理 | Nginx |
| 容器编排 | Docker Compose |
| 嵌入模型 | Ollama / OpenAI / MLX / llama.cpp |

## 系统架构

```
浏览器 → Nginx(:80)
          ├─ /api/*  → Node Gateway(:3000) → Python Service(:8000)
          └─ /*      → Frontend (静态资源)
```

六容器编排：PostgreSQL、ChromaDB、MinIO、Python 后端、Node 网关、Nginx 前端。

## 快速开始

### 前置条件

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- 本地运行的 [Ollama](https://ollama.ai)（用于 embedding 生成）

```bash
ollama pull qllama/bge-small-zh-v1.5
```

### 一键部署

```bash
cp .env.example .env
# 按需修改 .env（OLLAMA_BASE_URL 等）

docker compose up --build       # 前台运行
docker compose up --build -d    # 后台运行
```

启动后访问 http://localhost，注册账号即可使用。

| 服务 | 地址 |
|---|---|
| 前端 UI | http://localhost |
| Swagger 文档 | http://localhost/api/docs |
| MinIO 控制台 | http://localhost:9001 |

### 停止服务

```bash
docker compose down          # 停止容器，保留数据
docker compose down -v       # 停止容器并清除数据卷
```

## 本地开发

不需要完整 Docker 环境，只启动基础设施，各服务独立运行。

### 1. 启动基础设施

```bash
docker compose up postgres chromadb minio -d
```

### 2. 启动 Python 服务

```bash
cd services/python
uv sync                       # 安装依赖（首次）
uv run uvicorn app.main:app --reload --port 8000
```

### 3. 启动 Node 网关

```bash
cd services/node
npm install                   # 安装依赖（首次）
npm run dev                   # 端口 3000
```

### 4. 启动前端

```bash
cd frontend
npm install                   # 安装依赖（首次）
npm run dev                   # 端口 5173，自动代理 /api → :3000
```

## 项目结构

```
cift/
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── SPEC.md                          # 产品设计文档
│   ├── CHANGELOG.md                     # 变更日志
│   ├── PROGRESS.md                      # 开发进度
│   └── tasks/                           # 任务定义
├── infra/nginx/nginx.conf               # 顶层反向代理
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── api.ts                       # API 客户端（JWT 自动注入）
│       ├── utils/auth.ts                # Token 管理
│       ├── components/BasicLayout.tsx   # ProLayout + 认证守卫
│       └── pages/
│           ├── Login.tsx
│           ├── Home.tsx                 # 知识库列表
│           ├── KbDetail.tsx             # KB 详情（上传/文档/分段）
│           ├── Chat.tsx                 # RAG 对话
│           ├── RecallTest.tsx           # 召回测试（独立检索调试）
│           ├── QA.tsx                   # 智能问答（多 KB 检索 + 纯 LLM）
│           ├── ChunkPreview.tsx         # 分块对照预览
│           ├── Manage.tsx               # 模型 + API Key 管理
│           └── KnowledgeGraphPage.tsx   # 知识图谱
├── services/node/                       # API 网关
│   └── src/
│       ├── index.ts                     # Express 入口 + 路由注册
│       ├── config.ts / db.ts            # 配置 + 数据库迁移
│       ├── routes/                      # auth, kbs, documents, search,
│       │                                # chunkConfigs, modelConfigs, chat,
│       │                                # qa, prompts, export, knowledgeGraphs,
│       │                                # apiKeys, retrieval
│       ├── middleware/                   # JWT + API Key + 错误处理
│       └── services/                    # pythonClient, minioClient
└── services/python/                     # FastAPI 后端
    ├── pyproject.toml
    └── app/
        ├── main.py                      # FastAPI 入口 + lifespan
        ├── models/schemas.py            # Pydantic 模型
        ├── routers/                     # kbs, upload, chunking, search,
        │                                # chat, qa, prompts, export, documents,
        │                                # chunks, model_configs, ...
        ├── services/
        │   ├── database.py              # SQLAlchemy ORM (10 张表)
        │   ├── bm25.py                  # BM25 搜索引擎
        │   ├── chunker.py               # 分段器 (fixed / structural)
        │   ├── chroma_client.py         # ChromaDB 客户端
        │   ├── minio_client.py          # MinIO 客户端
        │   ├── embedding/               # 嵌入 Provider 抽象
        │   ├── rerank/                  # Rerank Provider 抽象
        │   ├── llm/                     # LLM 客户端（流式 + 非流式）
        │   └── parser/                  # 文档解析 (txt/md/pdf/docx/csv/json)
        └── utils/                       # config, logger
```

## API 接口

所有接口通过 Node Gateway `/api/*` 访问，需 JWT Bearer Token 或 API Key 认证（公开接口除外）。

### 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 获取当前用户 |

### 知识库

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/kbs` | 列出知识库 |
| POST | `/api/kbs` | 创建知识库 |
| GET | `/api/kbs/{kbId}` | 获取详情（含统计数据） |
| DELETE | `/api/kbs/{kbId}` | 删除知识库 |
| GET | `/api/kbs/{kbId}/export` | 导出 Chunk 数据（`?format=json\|csv`） |

### 文档

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/kbs/{kbId}/documents` | 列出文档 |
| POST | `/api/kbs/{kbId}/documents/upload` | 上传文件 |
| DELETE | `/api/kbs/{kbId}/documents/{docId}` | 删除文档 |
| GET | `/api/kbs/{kbId}/documents/{docId}/preview` | 文档预览 |
| GET | `/api/kbs/{kbId}/documents/{docId}/chunks` | 查看分块 |
| POST | `/api/kbs/{kbId}/documents/{docId}/chunk` | 执行分段 |
| GET | `/api/kbs/{kbId}/documents/{docId}/chunk-progress` | 分段进度 |

### 搜索

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/kbs/{kbId}/search` | 搜索（支持 vector/bm25/hybrid 模式 + rerank） |

### 智能问答

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/qa/sessions` | 创建问答会话 |
| GET | `/api/qa/sessions` | 列出会话 |
| PATCH | `/api/qa/sessions/{id}` | 重命名会话 |
| GET | `/api/qa/sessions/{id}/messages` | 消息历史 |
| DELETE | `/api/qa/sessions/{id}` | 删除会话 |
| POST | `/api/qa/sessions/{id}/stream` | SSE 流式问答 |

### 对话

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/chat/sessions` | 创建对话会话 |
| GET | `/api/chat/sessions?kb_id=xxx` | 列出会话 |
| GET | `/api/chat/sessions/{id}/messages` | 消息历史 |
| DELETE | `/api/chat/sessions/{id}` | 删除会话 |
| POST | `/api/chat/sessions/{id}/stream` | SSE 流式对话 |

### 分段配置

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/kbs/{kbId}/chunk-configs` | 列出配置 |
| POST | `/api/kbs/{kbId}/chunk-configs` | 创建配置 |
| PUT | `/api/kbs/{kbId}/chunk-configs/{id}` | 更新配置 |
| DELETE | `/api/kbs/{kbId}/chunk-configs/{id}` | 删除配置 |
| PUT | `/api/kbs/{kbId}/chunk-configs/{id}/default` | 设为默认 |

### Prompt 模板

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/kbs/{kbId}/prompt-templates` | 列出模板 |
| POST | `/api/kbs/{kbId}/prompt-templates` | 创建模板 |
| PUT | `/api/kbs/{kbId}/prompt-templates/{id}` | 更新模板 |
| DELETE | `/api/kbs/{kbId}/prompt-templates/{id}` | 删除模板 |
| PUT | `/api/kbs/{kbId}/prompt-templates/{id}/default` | 设为默认 |

### 模型管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/models` | 列出模型配置 |
| POST | `/api/models` | 创建模型配置 |
| PUT | `/api/models/{id}` | 更新模型配置 |
| DELETE | `/api/models/{id}` | 删除模型配置 |
| PUT | `/api/models/{id}/activate` | 设为活跃 |
| POST | `/api/models/test` | 测试连接 |

### 知识图谱

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/kbs/{kbId}/knowledge-graphs` | 创建并构建图谱 |
| GET | `/api/kbs/{kbId}/knowledge-graphs` | 列出图谱 |
| GET | `/api/kbs/{kbId}/knowledge-graphs/{id}` | 获取图谱数据 |
| DELETE | `/api/kbs/{kbId}/knowledge-graphs/{id}` | 删除图谱 |

### API Key

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/api-keys` | 列出 Key（脱敏） |
| POST | `/api/api-keys` | 创建 Key |
| DELETE | `/api/api-keys/{id}` | 删除 Key |

### 外部集成

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/retrieval` | Dify 兼容检索（仅 API Key 认证） |

## 配置说明

通过 `.env` 文件或环境变量配置，详见 `.env.example`。

### Node Gateway

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务端口 |
| `JWT_SECRET` | `change-me-in-production` | JWT 签名密钥 |
| `JWT_EXPIRES_IN` | `24h` | Token 过期时间 |
| `DATABASE_URL` | — | PostgreSQL 连接串（pg 格式） |
| `PYTHON_SERVICE_URL` | `http://localhost:8000` | Python 服务地址 |
| `MINIO_ENDPOINT` | `localhost:9000` | MinIO 地址 |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO Access Key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO Secret Key |
| `MINIO_BUCKET` | `cift-files` | 存储桶名称 |

### Python Service

| 变量 | 默认值 | 说明 |
|---|---|---|
| `EMBEDDING_PROVIDER` | `ollama` | 嵌入 Provider |
| `EMBEDDING_MODEL` | `qllama/bge-small-zh-v1.5` | 模型名称 |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 地址 |
| `DATABASE_URL` | — | SQLAlchemy 连接串（asyncpg 格式） |
| `CHROMA_HOST` | `chromadb` | ChromaDB 主机（空值则嵌入式模式） |
| `CHROMA_PORT` | `8000` | ChromaDB 端口 |

## License

MIT
