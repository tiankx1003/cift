# TASK 002: 分块可视化（查看文档分块结果）

## 目标

在知识库详情页的文档列表中，支持查看每个文档的分块结果，让用户了解文档是如何被切分的。

## 背景

- 当前文档上传后，Python 服务会对文件进行解析和分块（`services/python/app/services/chunker.py`）
- 分块结果存储在 ChromaDB 中，每个 chunk 有 `chunk_index`（序号）和 `content`（文本内容）
- 前端文档列表目前只显示文件名、类型、大小、状态、分块数，无法查看具体分块内容
- Node 网关已有文档相关路由 `services/node/src/routes/documents.ts`
- Python 服务目前没有「获取文档分块」的独立接口

## 实现要求

### 1. Python 服务 — 新增获取分块接口

在 `services/python/app/routers/` 下新增或扩展接口：

```
GET /internal/documents/{doc_id}/chunks?kb_id={kb_id}
```

返回：
```json
{
  "chunks": [
    { "chunk_index": 0, "content": "分块文本内容...", "char_count": 456 },
    { "chunk_index": 1, "content": "...", "char_count": 789 }
  ]
}
```

实现方式：从 ChromaDB 中按 `doc_id` 和 `kb_id` 过滤查询，按 `chunk_index` 排序返回。参考现有搜索接口 `services/python/app/routers/search.py` 中 ChromaDB 的调用方式。

### 2. Node 网关 — 新增代理接口

在 `services/node/src/routes/documents.ts` 中新增：

```
GET /api/kbs/:kbId/documents/:docId/chunks
```

- 需要 JWT 认证（已有 authRequired 中间件）
- 校验文档归属当前用户
- 代理到 Python 服务 `GET /internal/documents/{docId}/chunks?kb_id={kbId}`
- 同时需要从 PostgreSQL 的 documents 表获取 `filename` 一并返回

### 3. 前端 — 分块查看功能

修改 `frontend/src/pages/KbDetail.tsx`：

1. **API 层**（`frontend/src/api.ts`）：新增
```typescript
export interface ChunkInfo {
  chunk_index: number;
  content: string;
  char_count: number;
}
export interface ChunksResponse {
  filename: string;
  chunks: ChunkInfo[];
}
export const getDocumentChunks = (kbId: string, docId: string) =>
  request<ChunksResponse>(`/kbs/${kbId}/documents/${docId}/chunks`);
```

2. **UI 交互**：在文档列表的操作列，对状态为 `completed` 且 `chunk_count > 0` 的文档，新增一个「查看分块」按钮（使用 Ant Design 的 `Button` + `EyeOutlined` 图标或类似图标）

3. **分块展示**：点击后弹出 Modal（`Ant Design Modal`），展示：
   - 标题：`{filename} — 分块详情`
   - 列表：每个分块显示序号（chunk_index）、字符数（char_count）、内容（content）
   - 内容区域用 `<pre>` 或 `<Paragraph>` 包裹，设置最大高度和滚动（`maxHeight: 300, overflow: 'auto'`），避免长文本撑开 Modal
   - Modal 宽度建议 700px

### 不需要做的事

- ❌ 不修改分块逻辑本身
- ❌ 不修改上传/删除流程
- ❌ 不添加分块编辑功能
- ❌ 不添加新依赖（使用已有的 Ant Design 组件）

## 验收标准

1. Python 接口 `GET /internal/documents/{doc_id}/chunks` 能正确返回分块数据
2. Node 代理接口正常转发，包含认证和权限校验
3. 前端文档列表对已完成的文档显示「查看分块」按钮
4. 点击按钮弹出 Modal，展示所有分块的序号、字符数、内容
5. 长内容可滚动，不影响布局
6. 未完成或 chunk_count=0 的文档不显示按钮

## 自我测试

完成实现后，执行以下验证：

1. `cd /Users/tiankx/git_repo/cift/frontend && npm run build` — 前端构建无报错
2. `cd /Users/tiankx/git_repo/cift/services/node && npm run build` — Node 服务构建无报错
3. 检查 Python 服务无语法错误：`cd /Users/tiankx/git_repo/cift/services/python && python -c "from app.routers import *; print('OK')"`
4. 构建成功后在回复中确认，并简要说明各层实现方式
