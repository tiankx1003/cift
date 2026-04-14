# CIFT - 开发进度

## 2026-04-14

### 完成
- [x] **PostgreSQL 集成** — 替代 ChromaDB metadata，作为元数据存储
  - SQLAlchemy 2.0 async + asyncpg
  - ORM 模型：`knowledge_bases`（id, name, description, doc_count）、`documents`（id, kb_id FK, filename, file_type, file_size, storage_key, status, chunk_count, error_message）
  - KB CRUD 全部迁移到 PostgreSQL
  - 上传接口写入 document 记录，更新状态和 chunk_count
  - 删除接口同步清理 PostgreSQL 记录
  - 启动时自动建表（`init_db`）
- [x] **Docker Compose 编排** — 一键启动全部服务
  - 5 个容器：PostgreSQL 16、ChromaDB、MinIO、Python 后端、Nginx 前端
  - Nginx 反向代理：`/` 前端静态文件，`/internal/*` 代理到 Python 服务
  - 健康检查 + depends_on 链确保启动顺序
  - `.env` 管理所有配置（数据库密码、embedding 端点等）
  - Ollama 不包含在编排中，通过 `OLLAMA_BASE_URL` 环境变量指向宿主机
- [x] **Docker Compose 端到端验证通过**：`docker compose up` → 创建 KB → 上传文件 → 语义搜索

### 新增文件
- `docker-compose.yml` — 5 服务编排
- `.env.example` — 配置模板
- `services/python/Dockerfile` — Python 服务镜像
- `frontend/Dockerfile` — 多阶段构建（node build → nginx serve）
- `frontend/nginx.conf` — Nginx 反向代理配置
- `services/python/app/services/database.py` — SQLAlchemy ORM 模块

### 当前状态
- `docker compose up --build` 一键启动全部服务
- 浏览器访问 `http://localhost:80` 即可使用
- PostgreSQL 存储元数据，ChromaDB 只负责向量存储
- MinIO 存储原始文件

### 下一步
- [ ] 支持更多文件格式（PDF、Word）
- [ ] 前端适配 Node Gateway（切换 API 地址到 :3000 /api/*）
- [ ] Node Gateway 加入 Docker Compose
- [ ] 生产部署优化（HTTPS、密钥管理）

## Node API Gateway (`services/node/`)

### 2026-04-14 完成
- [x] **Node API Gateway 搭建** — Express + TypeScript，端口 3000
  - 认证系统：JWT + bcrypt，注册/登录/获取用户信息三个接口
  - 知识库 CRUD：GET/POST/GET/:id/PUT/:id/DELETE/:id，全部 JWT 保护 + 用户隔离
  - 文档管理：列表、上传（multer → MinIO → Python parse）、删除、重试解析
  - 语义搜索：代理到 Python `/internal/search`
  - 统一错误格式：`{ code, message, details }`
- [x] **数据库扩展** — 启动时自动迁移
  - 新建 `users` 表（id, username, password_hash, created_at, updated_at）
  - `knowledge_bases` 表新增 `user_id` 列，实现数据隔离
  - 与 Python 服务共用同一 PostgreSQL 数据库，互不干扰
- [x] **端到端验证通过**：注册 → 登录 → 创建 KB → 列表/更新 → 搜索 → 401/404 错误处理

### 新增文件
- `services/node/package.json` / `tsconfig.json`
- `services/node/src/index.ts` — Express 入口 + 自动迁移
- `services/node/src/config.ts` — 环境变量
- `services/node/src/db.ts` — pg 连接池 + 迁移
- `services/node/src/middleware/auth.ts` — JWT 认证
- `services/node/src/middleware/errorHandler.ts` — 统一错误处理
- `services/node/src/routes/auth.ts` — 认证路由
- `services/node/src/routes/knowledgeBases.ts` — KB 路由
- `services/node/src/routes/documents.ts` — 文档路由
- `services/node/src/routes/search.ts` — 搜索路由
- `services/node/src/services/pythonClient.ts` — Python 服务客户端
- `services/node/src/services/minioClient.ts` — MinIO 客户端

## 2026-04-13

### 完成
- [x] 前端 UI 搭建（React 19 + Vite + TypeScript + Ant Design 5）
  - 知识库列表页：卡片展示、新建知识库（Modal 表单）、删除知识库
  - 知识库详情页：文件上传、文档列表（含删除）、语义搜索（结果 + 相似度评分）
- [x] Python 服务新增 KB 管理接口
- [x] 接入 Ollama 真实 embedding 模型（qllama/bge-small-zh-v1.5）
- [x] 实现文件上传接口（POST /internal/upload, multipart/form-data）

## 2026-04-12

### 完成
- [x] 项目初始化 (git init, .gitignore, CLAUDE.md)
- [x] SPEC.md 编写（完整产品设计文档）
- [x] Python 服务骨架搭建（FastAPI + uv 管理）
- [x] 文件解析 + 文本分块（Markdown/TXT）
- [x] ChromaDB 集成（嵌入式 PersistentClient）
- [x] 向量搜索接口

### 技术笔记
- embedding_provider 默认为 ollama，模型 qllama/bge-small-zh-v1.5
- Docker 部署：`docker compose up --build`（端口 80）
- 本地开发前端：`cd frontend && npm run dev`（端口 5173，代理 /internal 到 :8000）
- 本地开发后端：`cd services/python && uv run uvicorn app.main:app --port 8000`
- 本地开发网关：`cd services/node && npm run dev`（端口 3000，需设置 DATABASE_URL、PYTHON_SERVICE_URL、JWT_SECRET）
