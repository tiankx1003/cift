# CIFT - 开发进度

## 2026-04-12

### 完成
- [x] 项目初始化 (git init, .gitignore, CLAUDE.md)
- [x] SPEC.md 编写（完整产品设计文档）
- [x] Python 服务骨架搭建（FastAPI + uv 管理）
- [x] 文件解析 + 文本分块（Markdown/TXT）
- [x] ChromaDB 集成（嵌入式 PersistentClient）
- [x] 向量搜索接口
- [x] 端到端测试通过（parse-direct + search）

### 当前状态
- Python 服务可正常启动和运行
- Embedding 使用 dummy_provider（伪向量，基于文本 hash）
- 搜索能返回结果但无真正语义匹配
- 前端/Node 服务/Docker 均未开始

### 下一步
- [ ] 接入真实 embedding 模型（优先 Ollama 本地模型）
- [ ] 实现真正的文件上传接口（multipart/form-data）
- [ ] 接入 PostgreSQL（替换/补充元数据存储）
- [ ] 前端 UI（可考虑先跳过 Node.js，直接对接 Python 服务）
- [ ] Docker Compose 编排

### 待决策
- Embedding 模型选择：Ollama 本地 vs OpenAI API
- 是否跳过 Node.js 层，前端直接调 Python
- 前端框架：React(Vite+Ant Design) 按原 spec，还是用更轻量方案

### 技术笔记
- embedding_provider 默认为 dummy，config.py 中 `embedding_provider` 字段控制
- chroma_path 默认 `./chroma_data`，数据持久化在本地
- 测试接口：`/internal/parse-direct`（跳过 MinIO，直接传文本）
