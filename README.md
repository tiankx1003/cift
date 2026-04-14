# CIFT

**Context Intelligence Framework & Toolkit** — 一个轻量级知识库管理系统，支持用户认证、文件上传、文本解析、向量嵌入和语义搜索。

## 功能特性

- 用户注册 / 登录（JWT 认证）
- 知识库管理（创建、查看、删除）
- 文件上传（支持 `.txt`、`.md`，multipart/form-data）
- 文档自动解析与文本分块（Markdown 按标题拆分，纯文本固定窗口）
- 向量嵌入（支持 Ollama、OpenAI、MLX、llama.cpp 等多种 Provider）
- 语义搜索（基于向量相似度，返回匹配片段与置信度）
- Docker Compose 一键部署

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19、TypeScript、Vite、Ant Design 6、ProLayout |
| API 网关 | Node.js 22、Express、TypeScript、JWT |
| 后端 | Python 3.12、FastAPI、SQLAlchemy 2.0 (async) |
| 关系数据库 | PostgreSQL 16 |
| 向量数据库 | ChromaDB |
| 对象存储 | MinIO |
| 反向代理 | Nginx |
| 容器编排 | Docker Compose |
| 嵌入模型 | Ollama (bge-small-zh-v1.5) |

## 系统架构

```
浏览器 → Nginx(:80)
           ├─ /api/*  → Node Gateway(:3000) → Python Service(:8000)
           └─ /*      → Frontend (静态资源)
```

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

启动后访问 http://localhost，注册账号即可使用。

| 服务 | 地址 |
|---|---|
| 前端 UI | http://localhost |
| Node API | http://localhost:3000/api |
| MinIO 控制台 | http://localhost:9001 |

### 停止服务

```bash
docker compose down          # 停止容器，保留数据
docker compose down -v       # 停止容器并清除数据卷
```

## 本地开发

不需要完整 Docker 环境，直接启动各服务。

### 1. 启动基础设施

```bash
docker compose up postgres chromadb minio -d
```

### 2. 启动 Python 服务

```bash
cd services/python

# 安装依赖（首次）
uv sync

# 启动开发服务器
uv run uvicorn app.main:app --reload --port 8000
```

### 3. 启动 Node 网关

```bash
cd services/node

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev
```

### 4. 启动前端

```bash
cd frontend

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev
```

前端开发服务器（http://localhost:5173）自动将 `/api/*` 请求代理到 Node 网关 `:3000`。

## 项目结构

```
cift/
├── docker-compose.yml              # 容器编排（6 个服务）
├── .env                            # 环境变量
├── docs/
│   ├── SPEC.md                     # 完整产品设计文档
│   ├── BUGS.md                     # Bug 跟踪
│   └── ...
├── infra/
│   └── nginx/
│       └── nginx.conf              # 顶层 Nginx 反向代理配置
├── frontend/                       # React 前端
│   ├── Dockerfile                  # 多阶段构建（Node → Nginx）
│   ├── nginx.conf                  # 前端 Nginx 静态资源服务
│   ├── src/
│   │   ├── api.ts                  # API 客户端（/api 基路径，JWT 自动注入）
│   │   ├── utils/auth.ts           # JWT Token 管理
│   │   ├── components/
│   │   │   └── BasicLayout.tsx     # ProLayout 布局 + 认证守卫
│   │   └── pages/
│   │       ├── Login.tsx           # 登录 / 注册
│   │       ├── Home.tsx            # 知识库列表
│   │       └── KbDetail.tsx        # 知识库详情（上传/文档/搜索）
│   └── ...
├── services/
│   ├── node/                       # Node.js API 网关
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts            # Express 入口
│   │       ├── config.ts           # 环境变量配置
│   │       ├── db.ts               # PostgreSQL 连接 + 迁移
│   │       ├── routes/
│   │       │   ├── auth.ts         # 认证（注册/登录/me）
│   │       │   ├── knowledgeBases.ts  # 知识库 CRUD
│   │       │   ├── documents.ts    # 文件上传/列表/删除
│   │       │   └── search.ts       # 语义搜索代理
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT 认证中间件
│   │       │   └── errorHandler.ts # 全局错误处理
│   │       └── services/
│   │           ├── pythonClient.ts # Python 服务 HTTP 客户端
│   │           └── minioClient.ts  # MinIO 客户端
│   └── python/                     # FastAPI 后端
│       ├── Dockerfile
│       ├── pyproject.toml
│       └── app/
│           ├── main.py             # FastAPI 入口 + lifespan
│           ├── models/schemas.py   # Pydantic 请求/响应模型
│           ├── routers/
│           │   ├── kbs.py          # 知识库 CRUD + 文档列表
│           │   ├── upload.py       # 文件上传（完整管道）
│           │   ├── parse.py        # 解析接口
│           │   ├── search.py       # 语义搜索
│           │   └── vectors.py      # 向量删除
│           ├── services/
│           │   ├── database.py     # SQLAlchemy ORM (PostgreSQL)
│           │   ├── chroma_client.py    # ChromaDB 客户端
│           │   ├── minio_client.py     # MinIO 客户端
│           │   ├── chunker.py      # 文本分块
│           │   ├── embedding/      # 向量嵌入 Provider 抽象
│           │   └── parser/         # 文档解析
│           └── utils/
│               ├── config.py       # pydantic-settings 配置
│               └── logger.py       # 结构化日志
└── CLAUDE.md                       # Claude Code 开发指引
```

## API 接口

前端通过 Node Gateway 的 `/api/*` 路由访问所有接口。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 获取当前用户（需认证） |

### 知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/kbs` | 列出当前用户的知识库 |
| POST | `/api/kbs` | 创建知识库 |
| GET | `/api/kbs/{kbId}` | 获取知识库详情 |
| DELETE | `/api/kbs/{kbId}` | 删除知识库 |

### 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/kbs/{kbId}/documents` | 列出文档 |
| POST | `/api/kbs/{kbId}/documents/upload` | 上传文件（multipart/form-data） |
| DELETE | `/api/kbs/{kbId}/documents/{docId}` | 删除文档及向量 |

### 搜索

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/kbs/{kbId}/search` | 语义搜索 |

## 配置说明

通过 `.env` 文件或环境变量配置。

### Node Gateway

| 变量 | 默认值 | 说明 |
|------|--------|------|
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
|------|--------|------|
| `EMBEDDING_PROVIDER` | `ollama` | 嵌入 Provider：`ollama` / `openai` / `mlx` / `llama_cpp` / `dummy` |
| `EMBEDDING_MODEL` | `qllama/bge-small-zh-v1.5` | 模型名称 |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama 地址 |
| `DATABASE_URL` | — | SQLAlchemy 连接串（asyncpg 格式） |
| `CHROMA_HOST` | `chromadb` | ChromaDB 主机（空值则使用嵌入式模式） |
| `CHROMA_PORT` | `8000` | ChromaDB 端口 |

## License

MIT
