## 完成状态: ✅

# TASK 007: 分段策略配置

## 目标

上传文件后不立即分段，改为支持用户配置分段策略（token 长度、重叠长度、自定义分隔符）后再执行分段。将「上传」和「分段」解耦为两个独立步骤。

## 背景

当前上传流程（`services/python/app/routers/upload.py`）：上传文件 → 立即解析 → 立即分段 → 立即 embedding → 写入 ChromaDB。整个过程同步完成，用户无法干预分段策略。

现有分块逻辑在 `services/python/app/services/chunker.py`：
- `TextChunker`：固定长度分块，chunk_size=800, chunk_overlap=200
- `MarkdownChunker`：按标题分段，超长 section fallback 到固定长度
- `make_chunks(text, file_type)` 统一入口

现有 Document ORM 模型（`services/python/app/services/database.py`）：status 字段值为 "parsing" / "completed" / "failed"。

## 实现要求

### 1. PostgreSQL — 新增分段配置表

在 `services/python/app/services/database.py` 新增 `ChunkConfig` 模型：

```python
class ChunkConfig(Base):
    __tablename__ = "chunk_configs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    kb_id: Mapped[str] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    chunk_size: Mapped[int] = mapped_column(Integer, default=800)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=200)
    separators: Mapped[str] = mapped_column(Text, default="")  # 逗号分隔的自定义分隔符，如 "\\n\\n,##,"
    is_default: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

每个知识库可以有多个分段策略，其中一个标记为 `is_default`。

### 2. Python 服务 — 修改上传流程 + 新增分段接口

**修改上传流程**（`upload.py`）：
- 上传文件后只做解析提取文本，存储到 MinIO，不做分段和 embedding
- Document status 改为 `"uploaded"`（新增状态）
- 提取后的文本存储到 Document 表或 MinIO（建议在 documents 表新增 `extracted_text` Text 列，方便分段时读取；如果文本太大则存 MinIO，但 MVP 阶段直接存数据库即可）
- 如果解析失败，status 设为 `"parse_failed"`

**新增分段接口**（新文件 `services/python/app/routers/chunking.py`）：
```
POST /internal/documents/{doc_id}/chunk
Body: {
  "kb_id": "xxx",
  "config_id": "xxx"        // 使用已有配置
  // 或直接传参（不保存配置）
  "chunk_size": 800,
  "chunk_overlap": 200,
  "separators": "\\n\\n,##,"
}
Response: {
  "doc_id": "xxx",
  "status": "completed",
  "chunk_count": 12
}
```

分段逻辑：
1. 读取文档的 extracted_text
2. 根据配置参数创建 Chunker
3. 分块后生成 embedding
4. 写入 ChromaDB
5. 更新 Document status 为 "completed"，chunk_count

**分段配置 CRUD**（新文件 `services/python/app/routers/chunk_configs.py`）：
```
GET    /internal/kbs/{kb_id}/chunk-configs          # 列表
POST   /internal/kbs/{kb_id}/chunk-configs          # 创建
PUT    /internal/kbs/{kb_id}/chunk-configs/{id}     # 更新
DELETE /internal/kbs/{kb_id}/chunk-configs/{id}     # 删除
PUT    /internal/kbs/{kb_id}/chunk-configs/{id}/default  # 设为默认
```

### 3. Node 网关 — 代理新接口

在 `services/node/src/routes/` 新增或扩展：
- 分段接口代理：`POST /api/kbs/:kbId/documents/:docId/chunk`
- 分段配置 CRUD 代理：`GET/POST/PUT/DELETE /api/kbs/:kbId/chunk-configs`
- 全部需要 JWT 认证 + 用户隔离（校验 kb 归属）

### 4. 前端 — UI 改造

**修改上传流程**（`KbDetail.tsx`）：
- 上传后文档状态显示为「已上传（待分段）」
- 新增状态 `uploaded` 对应的 Tag 颜色（如蓝色 "待分段"）
- 新增状态 `parse_failed` 对应的 Tag 颜色（红色 "解析失败"）

**分段操作**：
- 文档列表中，对 `uploaded` 状态的文档显示「分段」按钮
- 点击后弹出 Modal：
  - 选择分段配置（下拉框，从 API 获取该 KB 的配置列表）
  - 或展开「自定义配置」表单：chunk_size（数字输入）、chunk_overlap（数字输入）、separators（文本输入，提示用逗号分隔）
  - 确认后调用分段接口
  - 成功后刷新文档列表

**分段配置管理**：
- 在知识库详情页新增 Tab 或 Card：「分段策略」
- 展示配置列表，支持新增、编辑、删除、设为默认
- 使用 Ant Design Table + Modal Form

### 5. 修改 Chunker 支持自定义分隔符

在 `chunker.py` 中扩展：
- `TextChunker` 新增 `separators` 参数
- 当有自定义分隔符时，优先按分隔符切分，再对长段落做固定长度分块
- `make_chunks` 函数签名扩展为 `make_chunks(text, file_type, chunk_size, chunk_overlap, separators)`

### Pydantic 模型

在 `schemas.py` 新增：
```python
class ChunkConfigCreate(BaseModel):
    name: str
    chunk_size: int = 800
    chunk_overlap: int = 200
    separators: str = ""

class ChunkConfigUpdate(BaseModel):
    name: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    separators: str | None = None

class ChunkConfigInfo(BaseModel):
    id: str
    name: str
    chunk_size: int
    chunk_overlap: int
    separators: str
    is_default: bool

class ChunkRequest(BaseModel):
    kb_id: str
    config_id: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    separators: str | None = None
```

## 验收标准

1. 上传文件后，文档状态为「待分段」，不做 embedding
2. 可以创建、编辑、删除、设为默认分段配置
3. 对待分段文档执行分段，支持选择已有配置或自定义参数
4. 分段成功后文档状态变为「完成」，chunk_count 正确
5. 自定义分隔符生效（如按 `\n\n` 分段）
6. 对已分段的文档重新分段时，先清除旧 chunk 和向量再重新生成

## 自我测试

完成实现后，执行以下验证：

1. `cd /Users/tiankx/git_repo/cift/services/python && python -c "from app.models.schemas import *; from app.services.database import *; print('OK')"` — 无报错
2. `cd /Users/tiankx/git_repo/cift/services/node && npm run build` — Node 构建无报错
3. `cd /Users/tiankx/git_repo/cift/frontend && npm run build` — 前端构建无报错
4. 检查 `upload.py` 中上传后不再调用 `make_chunks` 和 embedding 逻辑
5. 检查数据库表定义中 `extracted_text` 列和 `chunk_configs` 表存在
6. 构建成功后在回复中确认，并简要说明各层实现方式和关键改动
