# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.6.0] - 2026-05-01

### Added

- **智能问答模块** — 独立对话，支持多知识库检索和纯 LLM 对话
  - 新增 `qa_sessions` / `qa_messages` 数据库表（Session 不绑定 kb_id）
  - 多 KB 检索：遍历选中 KB 的 ChromaDB collection，合并排序取 top_k
  - 不选知识库时跳过检索，纯 LLM 直接回答
  - SSE 流式输出（复用 Chat 协议）
  - 前端 QA 页面：KB 多选、会话管理（新建/重命名/删除）、流式消息
  - 侧边栏新增「智能问答」菜单项
- **召回测试独立页面** — 从 KB 详情页剥离语义搜索，独立调试检索效果
  - 路由 `/kb/:kbId/recall`，左右布局
  - 左侧固定参数面板：检索模式、重排序开关、top-k、相似度阈值、向量权重（可拖动 + 可输入）
  - 右侧分页结果（默认 30 条/页），关键词高亮
  - 混合检索分别展示混合/语义/关键词三项分数

### Changed

- 混合检索 BM25 分数改为归一化（0-1）返回，前端正确显示百分比
- 分块默认值从 800/200 调整为 512/64（匹配 bge-small-zh-v1.5 的 512 token 限制）
- KB 详情页上传按钮移至 header，与「对话」「导出」并列
- 侧边栏收起按钮移至左下角，宽度缩窄至 160px
- 对话页面返回按钮移至「对话列表」标题处

### Fixed

- KB 详情页向量数显示为 0（改用 Python 服务查询 ChromaDB）
- 文档处理中状态 Spin 图标与文字重叠（改用 Tag 显示）
- 混合检索 ChromaDB `search_params` 参数不兼容导致 500 错误

## [0.5.0] - 2026-04-27

### Added

- **RAG 对话问答** — 多轮对话，SSE 流式逐字输出，自动检索上下文 + LLM 生成回答
  - 对话会话 CRUD（`/api/chat/sessions`）
  - SSE 流式对话端点（`/api/chat/sessions/{id}/stream`）
  - 引用来源标注（chunk + 来源文档名 + 相似度）
  - Prompt 模板管理（按知识库隔离，支持 `{context}`、`{question}` 变量）
  - LLM 流式支持（`OpenAILLMClient.chat_stream()`，httpx SSE）
  - 前端 Chat 页面：会话列表、消息气泡、流式逐字展示
- **Rerank 重排序** — 搜索结果经 Rerank 模型重新打分，无模型时自动降级
  - 搜索接口新增 `use_rerank` 参数
  - 前端搜索参数面板新增「启用重排序」开关
  - 搜索结果展示 rerank_score
- **混合检索（BM25 + 向量）** — 三种检索模式
  - `vector`（语义搜索）、`bm25`（关键词搜索）、`hybrid`（加权融合）
  - BM25Index：英文空格分词 + 中文单字/双字组合
  - BM25 分数 min-max 归一化，按 `vector_weight` 加权融合
  - 前端搜索面板新增检索模式选择
- **知识库管理增强**
  - KB 详情页统计面板（分块数、向量数、存储大小，后端真实数据）
  - Chunk 导出：JSON / CSV 格式下载
  - 文档状态展示改进（Spin 动画、错误 Tooltip、上传后自动轮询）
- **文件格式扩展 + 文档在线预览**
  - 新增 CsvParser（多编码支持，表头前缀 + 每行内容）
  - 新增 JsonParser（数组/对象/嵌套递归展平）
  - 文档在线预览（Modal 展示 extracted_text）
  - Python / Node / 前端三方同步扩展 `.csv`、`.json`

### Changed

- `SearchRequest` 新增 `use_rerank`、`search_mode` 字段
- `SearchResult` 新增 `rerank_score`、`bm25_score` 字段
- `KbInfo` 新增 `total_chunks`、`total_vectors` 字段
- `DocumentInfo` 新增 `error_message` 字段
- 搜索路由重构：支持 vector / bm25 / hybrid 三种模式 + rerank 后处理
- 上传允许的文件类型扩展：`.csv`、`.json`

## [0.4.0] - 2026-04-27

### Added

- **结构化分段策略** — 按标题/章节识别文档结构，按层级切分
  - Python 新增 `StructuralChunker`，支持 Markdown 标题层级（H1-H6）和中文章节格式
  - 支持 `heading_level=0` 自动检测最合适的标题层级
  - 分段配置新增 `strategy`（fixed/structural）和 `heading_level` 字段
- **搜索参数可调** — 全栈改造
  - Python `SearchRequest` 新增 `similarity_threshold`、`vector_weight`、`hybrid_threshold`
  - 前端新增可折叠搜索参数面板（滑块调节 top-k / 相似度 / 向量权重）
- **召回结果展示优化**
  - Python 搜索接口批量查询文档名并注入 metadata
  - 前端搜索结果展示来源文档名（可点击跳转）、分块编号 Tag
- **统一 API 响应格式 + 错误码**
  - Node 层新增 `apiResponse.ts` 工具函数
  - 错误码范围：40001 参数、40101 认证、40401 资源、50001 内部
- **API Key 管理** — 全栈
  - `Authorization: Bearer ck-...` 和 `X-API-Key: ck-...` 两种认证方式
  - 前端管理页新增「API Keys」区域（创建、列表脱敏、删除）
- **API 文档** — 集成 Swagger UI（`/api/docs`）
- **Dify 兼容检索接口** — `POST /api/retrieval`，仅 API Key 认证

## [0.3.0] - 2026-04-26

### Added

- **分段异步任务化** — 全栈改造
  - PostgreSQL 新增 `chunk_tasks` 表
  - 分段接口改为异步：立即返回 task_id，后台执行
  - 前端分段后自动轮询进度（2s 间隔）
- **分隔符对齐分段** — 改造 TextChunker 算法
  - 预设分隔符优先级列表，在 chunk_size 附近双向搜索
  - 最大分段长度不超过 chunk_size × 2
- **分块预览分页** — ChunkPreview 页面支持分页（20/50/100 条）

## [0.2.0] - 2026-04-17

### Added

- **搜索结果关键词高亮** — `highlightText` 函数，大小写不敏感
- **分块可视化** — Python chunks 接口 + Node 代理 + 前端 Modal 查看分块
- **分段策略配置** — 解耦上传和分段
  - PostgreSQL 新增 `chunk_configs` 表
  - 分段配置 CRUD（chunk_size / chunk_overlap / separators）
  - 前端文档列表新增「分段」按钮 + 分段策略管理 Card
- **模型管理** — LLM / Embedding / Rerank 模型配置
  - PostgreSQL 新增 `model_configs` 表
  - 模型配置 CRUD + 测试连接
  - 前端左侧边栏「管理」页面
- **分块原文对照预览** — 左右分栏预览，高亮对应区域
- **知识图谱** — LLM 实体抽取 + SVG 可视化
  - PostgreSQL 新增 `knowledge_graphs` 表
  - 异步构建任务（NetworkX）
  - 按实体类型颜色区分

## [0.1.1] - 2026-04-16

### Added

- **PDF 和 Word 解析支持**
  - `PdfParser`（PyMuPDF，逐页提取）
  - `DocxParser`（python-docx，段落提取）
  - Python / Node / 前端三方同步扩展

## [0.1.0] - 2026-04-14

### Added

- **Docker Compose 编排** — 一键部署
  - 6 容器：PostgreSQL 16、ChromaDB、MinIO、Python 后端、Node 网关、Nginx 前端
  - 健康检查 + depends_on + `.env` 管理
- **PostgreSQL 集成** — 替代 ChromaDB metadata
  - SQLAlchemy 2.0 async + asyncpg
  - ORM 模型：`knowledge_bases`、`documents`
  - 启动时自动建表
- **Node API Gateway** — Express + TypeScript
  - JWT 认证（注册 / 登录 / me）
  - 知识库 CRUD + 文档上传 + 语义搜索代理
  - 用户隔离（`knowledge_bases.user_id`）

## [0.0.1] - 2026-04-12

### Added

- 项目初始化（git init、.gitignore、CLAUDE.md、SPEC.md）
- Python 服务骨架（FastAPI + uv）
- 文件解析 + 文本分块（Markdown / TXT）
- ChromaDB 向量存储集成
- 语义搜索接口
- 前端 UI 搭建（React 19 + Vite + TypeScript + Ant Design）
- 知识库列表页、详情页（文件上传、文档列表、语义搜索）
- Ollama embedding 模型集成（qllama/bge-small-zh-v1.5）

[0.6.0]: https://github.com/user/cift/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/user/cift/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/user/cift/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/user/cift/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/user/cift/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/user/cift/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/user/cift/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/user/cift/releases/tag/v0.0.1
