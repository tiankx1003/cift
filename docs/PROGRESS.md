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
- [ ] 前端体验优化（拖拽上传、搜索高亮、分块预览）
- [ ] 用户认证（JWT）
- [ ] 生产部署优化（HTTPS、密钥管理）

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
