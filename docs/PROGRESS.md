# CIFT - 开发进度

## 2026-04-27

### Phase 5 完成 ✅

核心目标：RAG 对话问答、检索质量提升、管理能力完善

- [x] **TASK 016: KB 管理增强**
  - KB 详情页统计面板：从后端获取真实分块数和向量数 + 文件大小统计
  - Chunk 导出：支持 JSON/CSV 格式，Python ChromaDB 查询 → Node 代理 → 前端下载
  - 文档状态展示：processing 显示 Spin、failed 显示错误 Tooltip、上传后自动轮询

- [x] **TASK 017: 文件格式扩展 + 文档在线预览**
  - 新增 CsvParser（stdlib csv 模块，多编码支持）和 JsonParser（数组/对象/嵌套展平）
  - Python/Node/前端三方同步扩展支持 `.csv`、`.json`
  - 文档预览：Python 返回 extracted_text，Node 代理，前端 Modal 展示

- [x] **TASK 018: Rerank 重排序串联**
  - 搜索接口新增 `use_rerank` 参数，查询活跃 Rerank 模型
  - 启用时多召回 `top_k × 3` 候选，经 Rerank 后取 top_k
  - 无 Rerank 模型或调用失败时降级为纯向量搜索
  - 前端搜索参数面板新增「启用重排序」开关，结果展示 rerank_score

- [x] **TASK 019: 混合检索（BM25 + 向量）**
  - Python 新增 `BM25Index` 类（英文空格分词 + 中文单字/双字组合）
  - 搜索接口新增 `search_mode` 参数：`vector`/`bm25`/`hybrid`
  - hybrid 模式：向量搜索 + BM25 搜索，按 `vector_weight` 加权融合
  - BM25 分数 min-max 归一化到 0-1
  - 前端搜索面板新增检索模式选择（语义/关键词/混合）

- [x] **TASK 020: RAG 对话问答**
  - **20.1 对话基础能力**
    - PostgreSQL 新增 `chat_sessions`、`chat_messages` 表
    - LLM 流式支持：`OpenAILLMClient.chat_stream()` 使用 httpx SSE 流
    - Python Chat Router：会话 CRUD + SSE 流式对话（query → 搜索 → 拼 prompt → LLM stream → SSE events）
    - Node Chat Router：CRUD 代理 + SSE 流 pipe
    - 前端 Chat 页面：左侧会话列表 + 右侧消息区 + 流式逐字展示 + 引用来源展示
    - KbDetail 页新增「对话」按钮跳转到 `/kb/:kbId/chat`
  - **20.2 Prompt 模板管理**
    - PostgreSQL 新增 `prompt_templates` 表
    - Python/Node CRUD 端点（按 KB 隔离 + 全局模板）
    - 默认模板：知识库问答助手 + {context}/{question} 变量
    - 对话接口自动加载 KB 默认模板

### 新增文件
- `services/python/app/services/parser/csv_parser.py` — CSV 解析器
- `services/python/app/services/parser/json_parser.py` — JSON 解析器
- `services/python/app/services/bm25.py` — BM25 搜索引擎
- `services/python/app/routers/export.py` — Chunk 导出端点
- `services/python/app/routers/documents.py` — 文档预览端点
- `services/python/app/routers/chat.py` — 对话路由（会话 CRUD + SSE 流）
- `services/python/app/routers/prompts.py` — Prompt 模板 CRUD
- `services/node/src/routes/export.ts` — 导出代理
- `services/node/src/routes/chat.ts` — 对话路由代理 + SSE pipe
- `services/node/src/routes/prompts.ts` — Prompt 模板代理
- `frontend/src/pages/Chat.tsx` — 对话 UI 页面

### Docker 构建验证通过
- `docker compose build` 全部通过（Python/Node/Frontend）

### Phase 4 完成

- [x] **TASK 013: 分段能力强化**
  - **13.1 按标题/章节分段** — 结构化分段策略
    - Python 新增 `StructuralChunker`，支持 Markdown 标题层级（H1-H6）和中文章节格式（第X章、一、、1.1 等）识别
    - 按 heading_level 切分，章节过长时二次分隔符对齐切分
    - 支持 heading_level=0 自动检测最合适的标题层级
    - 分段配置新增 `strategy`（fixed/structural）和 `heading_level`（0=auto, 1-6）字段
    - 前端分段配置、执行分段、批量分段 Modal 均新增策略和层级选择器
  - **13.2 LLM 智能分段** — ⏸️ 跳过（需 LLM 基础设施，MVP 暂缓）
  - **13.3 分段质量评估** — ⏸️ 跳过（优先级低，待策略稳定后评估）

- [x] **TASK 014: 搜索召回优化**
  - **14.1 搜索参数可调** — 全栈改造
    - Python `SearchRequest` 新增 `similarity_threshold`、`vector_weight`、`hybrid_threshold`
    - 前端新增可折叠搜索参数面板（滑块调节 top-k/相似度阈值/向量权重/混合阈值）
    - Node 透传所有搜索参数
  - **14.2 召回结果展示优化** — 前端改造
    - Python 搜索接口批量查询文档名并注入 metadata
    - 前端搜索结果展示来源文档名（可点击跳转预览）、分块编号 Tag

- [x] **TASK 015: 开放接口能力**
  - **15.2 统一 API 响应格式 + 错误码** — Node 层
    - 新增 `apiResponse.ts` 工具函数（success/created/list/error）
    - 定义错误码范围：40001-40099 参数、40101-40199 认证、40401-40499 资源、40901-40999 冲突、50001-50099 内部
  - **15.4 API Key 管理** — 全栈
    - PostgreSQL 新增 `api_keys` 表（id, user_id, key, name, is_active, created_at, last_used_at）
    - Node 新增 API Key CRUD 路由（`POST/GET/DELETE /api/api-keys`）
    - 认证中间件支持 `Authorization: Bearer ck-...` 和 `X-API-Key: ck-...` 两种方式
    - 前端管理页新增「API Keys」区域（创建、列表脱敏展示、删除）
  - **15.1 补齐缺失接口** — 确认所有必需接口已在前期 Task 中实现
  - **15.3 API 文档** — Node 层
    - 集成 `swagger-ui-express` + `swagger-jsdoc`
    - 路由添加 JSDoc 注释，访问 `/api/docs` 查看 Swagger UI
  - **15.5 Dify 兼容检索接口** — 全栈
    - Python 新增 `POST /internal/retrieval` 端点
    - Node 新增 `POST /api/retrieval` 路由，仅 API Key 认证
    - 兼容 Dify 外部知识库 API 规范（knowledge_id/query/retrieval_setting/records）

### 新增文件
- `services/python/app/routers/retrieval.py` — Dify 兼容检索端点
- `services/node/src/utils/apiResponse.ts` — 统一响应格式工具
- `services/node/src/middleware/apiKeyAuth.ts` — API Key 认证中间件
- `services/node/src/routes/apiKeys.ts` — API Key CRUD 路由
- `services/node/src/routes/retrieval.ts` — Dify 兼容检索路由
- `services/node/src/swagger.ts` — Swagger/OpenAPI 配置

### 修改文件
- `services/python/app/services/chunker.py` — 新增 StructuralChunker
- `services/python/app/services/database.py` — ChunkConfig 新增 strategy/heading_level
- `services/python/app/models/schemas.py` — 新增搜索参数、Dify 检索 schema、分段策略字段
- `services/python/app/routers/search.py` — 相似度阈值过滤 + 文档名注入
- `services/python/app/routers/chunking.py` — 透传 strategy/heading_level
- `services/python/app/routers/chunk_configs.py` — 处理新字段
- `services/python/app/routers/__init__.py` — 注册 retrieval_router
- `services/python/app/main.py` — 注册 retrieval_router
- `services/node/src/db.ts` — 新增 api_keys 表迁移
- `services/node/src/index.ts` — 注册 api-keys/retrieval/swagger 路由
- `services/node/src/middleware/errorHandler.ts` — 使用规范错误码
- `services/node/src/routes/search.ts` — 透传搜索参数
- `services/node/src/services/pythonClient.ts` — 新增 retrieval 方法 + 搜索参数
- `frontend/src/api.ts` — 新增 API Key 接口、搜索参数、分段策略类型
- `frontend/src/pages/KbDetail.tsx` — 搜索参数面板 + 分段策略选择器 + 结果展示优化
- `frontend/src/pages/Manage.tsx` — API Keys 管理区域

### Docker 端到端验证通过
- `docker compose up --build` 全部服务正常启动
- 注册 → 登录 → 创建 KB → 创建 API Key → API Key 检索 → 全流程验证通过

## 2026-04-26

### Phase 3 完成

- [x] **TASK 012: 分段异步化 + 分隔符对齐分段**
  - **12.3 分块预览分页** — ChunkPreview 页面支持分页（默认 50 条，可选 20/50/100），使用 Ant Design List pagination
  - **12.1 分段异步任务化** — 全栈改造
    - PostgreSQL 新增 `chunk_tasks` 表（task_id, doc_id, status, progress, total_chunks, current_chunk, error_message）
    - Python `POST /internal/documents/{doc_id}/chunk` 改为异步：立即返回 task_id，后台 asyncio.ensure_future 执行分段
    - Python 新增 `GET /internal/documents/{doc_id}/chunk-progress` 查询分段进度
    - Node 代理异步分段接口（返回 task_id）+ 新增进度查询代理
    - 前端点击分段后 toast 提示「分段任务已提交」，文档列表新增「进度」列，2 秒自动轮询，完成/失败后自动刷新
  - **12.2 分隔符对齐分段** — 改造 TextChunker._aligned_chunk 算法
    - 预设分隔符优先级列表（\n\n > \n > 。> ？> ！> ；> . > ? > ! > 空格）
    - 在 chunk_size 附近双向搜索分隔符，取最近者作为切分点
    - 最大分段长度不超过 chunk_size × 2
    - 自定义分隔符通过分段配置覆盖，无分隔符时退化为固定长度切分

### 新增文件
- （无新增文件，全部为现有文件改造）

### 修改文件
- `frontend/src/pages/ChunkPreview.tsx` — 分页支持
- `frontend/src/pages/KbDetail.tsx` — 异步分段 UI + 进度轮询 + 进度列
- `frontend/src/api.ts` — 新增 ChunkTaskInfo 类型 + getChunkProgress 接口
- `services/python/app/services/chunker.py` — 分隔符对齐算法
- `services/python/app/services/database.py` — 新增 ChunkTask ORM 模型
- `services/python/app/services/__init__.py` — 导出 ChunkTask
- `services/python/app/models/schemas.py` — 新增 ChunkTaskResponse schema
- `services/python/app/routers/chunking.py` — 异步分段 + 进度查询接口
- `services/node/src/services/pythonClient.ts` — 新增 getChunkProgress 方法
- `services/node/src/routes/documents.ts` — 新增进度查询代理路由

## 2026-04-17

### Phase 2 完成

- [x] **TASK 005: 搜索结果关键词高亮** — `highlightText` 函数，indexOf 大小写不敏感，`<mark>` 黄色背景
- [x] **TASK 006: 分块可视化** — Python chunks 接口 + Node 代理 + 前端 Modal 查看分块
- [x] **TASK 007: 分段策略配置** — 解耦上传和分段
  - PostgreSQL 新增 `chunk_configs` 表、Document 表新增 `extracted_text` 列
  - 上传后只做解析存储文本，不再自动分段和 embedding
  - 新增分段配置 CRUD（chunk_size / chunk_overlap / separators）
  - 新增 `POST /internal/documents/{doc_id}/chunk` 执行分段 + embedding
  - 前端文档列表新增「分段」按钮 + 分段策略管理 Card
- [x] **TASK 008: 模型管理** — LLM / Embedding / Rerank 模型配置
  - PostgreSQL 新增 `model_configs` 表
  - Python 新增 rerank provider（Ollama / OpenAI）、模型配置 CRUD + 测试连接
  - 前端左侧边栏「管理」页面，三 Tab 管理 LLM / Embedding / Rerank 配置
- [x] **TASK 009: 分块原文对照预览** — 左右分栏预览
  - 扩展 chunks 接口返回 `extracted_text` + `start_offset` / `end_offset`
  - `make_chunks` 返回值新增 offset 字段
  - 前端新增 `ChunkPreview` 页面：左侧分块列表、右侧原文高亮、自动滚动、禁止复制
  - 文档列表文件名可点击跳转预览
- [x] **TASK 010: 知识图谱** — LLM 实体抽取 + 可视化
  - PostgreSQL 新增 `knowledge_graphs` 表
  - Python 新增 LLM 客户端（OpenAI 兼容）、图谱构建异步任务（NetworkX）
  - Node 新增图谱 CRUD 代理
  - 前端左侧边栏「知识图谱」页面，SVG 可视化，按实体类型颜色区分
  - `pyproject.toml` 新增 `networkx` 依赖

### 新增文件
- `services/python/app/routers/chunks.py` — 分块查询
- `services/python/app/routers/chunking.py` — 执行分段
- `services/python/app/routers/chunk_configs.py` — 分段配置 CRUD
- `services/python/app/routers/model_configs.py` — 模型配置 CRUD + 测试
- `services/python/app/routers/knowledge_graphs.py` — 知识图谱构建 + CRUD
- `services/python/app/services/rerank/` — Rerank provider（base / ollama / openai / factory）
- `services/python/app/services/llm/` — LLM 客户端（base / openai / factory）
- `services/node/src/routes/chunkConfigs.ts` — 分段配置代理
- `services/node/src/routes/modelConfigs.ts` — 模型配置代理
- `services/node/src/routes/knowledgeGraphs.ts` — 知识图谱代理
- `frontend/src/pages/Manage.tsx` — 模型管理页面
- `frontend/src/pages/ChunkPreview.tsx` — 分块对照预览页面
- `frontend/src/pages/KnowledgeGraphPage.tsx` — 知识图谱页面

## 2026-04-16

### 完成
- [x] **PDF 和 Word（docx）解析支持** — 扩展文件上传格式
  - 新增 `PdfParser`（PyMuPDF / fitz，逐页提取文本）
  - 新增 `DocxParser`（python-docx，提取段落文本）
  - Python `parser/__init__.py` 注册新解析器
  - Python `upload.py` 扩展 `ALLOWED_EXTENSIONS` 和 `MIME_MAP`
  - Node `documents.ts` 同步扩展文件类型校验和 MIME 映射
  - 前端 `KbDetail.tsx` 更新上传 accept、校验白名单、按钮文案
  - `pyproject.toml` 新增 `pymupdf`、`python-docx` 依赖

### 新增文件
- `services/python/app/services/parser/pdf_parser.py`
- `services/python/app/services/parser/docx_parser.py`

### 待验证
- 部分扫描版 PDF 可能提取不到文本（纯文本 PDF 正常）

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

### Phase 2 路线图（2026-04-17 规划）— 全部完成 ✅

| # | 功能 | 涉及层 | 复杂度 | 状态 |
|---|------|--------|--------|------|
| A | 分段策略配置 | 前端 + Python | 中 | ✅ TASK 007 |
| B | 模型管理 | 前端 + Node + Python | 中 | ✅ TASK 008 |
| C | 分块原文对照预览 | 前端 + Python | 高 | ✅ TASK 009 |
| D | 知识图谱 | 前端 + Python | 高 | ✅ TASK 010 |

依赖关系：A → B（不同 embedding 模型对 token 长度限制不同）
技术选型待定：知识图谱（D）待调研 Neo4j / NetworkX + D3.js / ECharts 等方案

### Phase 4 路线图（2026-04-27 规划）— ✅ 已完成

三大方向：分段能力强化、搜索召回优化、开放接口能力

**方向一：分段能力强化**
- [x] 按标题/章节分段（识别文档结构，按层级切分）— TASK 13.1
- ⏸️ LLM 智能分段 — 跳过
- ⏸️ 分段质量评估 — 跳过

**方向二：搜索召回优化**
- [x] 搜索参数可调（top-k、相似度阈值）— TASK 14.1
- [x] 召回结果展示优化（来源文档、分块编号）— TASK 14.2
- [x] Rerank 重排序串联 — TASK 018 (Phase 5)
- [x] 混合检索（向量 + 关键词 BM25）— TASK 019 (Phase 5)

**方向三：开放接口能力**
- [x] 统一 API 响应格式 + 错误码规范 — TASK 15.2
- [x] API Key 管理（独立于 JWT 的接口调用凭证）— TASK 15.4
- [x] 补齐缺失接口 — TASK 15.1
- [x] API 文档（Swagger/OpenAPI）— TASK 15.3
- [x] Dify 兼容检索接口 — TASK 15.5

### Phase 5 路线图（2026-04-27 规划）— ✅ 已完成

核心目标：RAG 对话问答、检索质量提升、管理能力完善

| # | Task | 方向 | 复杂度 | 状态 |
|---|------|------|--------|------|
| 016 | RAG 对话问答 | 核心功能 | 高 | ✅ 已完成 |
| 017 | Rerank 重排序串联 | 检索质量 | 中 | ✅ 已完成 |
| 018 | 混合检索（BM25 + 向量） | 检索质量 | 中 | ✅ 已完成 |
| 019 | 知识库管理增强 | 管理完善 | 低 | ✅ 已完成 |
| 020 | 文件格式扩展 + 文档在线预览 | 文件能力 | 中 | ✅ 已完成 |

**执行顺序：** 019 → 020 → 017 → 018 → 016

**⏸️ 暂缓**
- LLM 智能分段（TASK 013.2 可选）
- 分段质量评估（TASK 013.3 可选）
- HTTPS + 密钥管理
- 多租户/权限管理

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
