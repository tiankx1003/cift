## 完成状态: ✅

# TASK 009: 分块原文对照预览

## 目标

点击文档列表中的文件名，打开左右分栏的对照预览页面：左侧展示分段结果列表，右侧渲染原文并高亮当前选中分块对应的区域。原文区域为只读预览，不可选中复制。

## 背景

- 已有分块查看功能（TASK 006）：通过 Modal 弹窗展示分块列表
- 已有 chunks 接口：`GET /internal/documents/{doc_id}/chunks?kb_id={kb_id}`
- 已有 `Document.extracted_text` 列（TASK 007 新增）存储解析后的原文
- 已有 `ChunkConfig` 配置，分块参数记录在配置中

**前置依赖**：TASK 007（分段策略配置）必须先完成，因为需要 `extracted_text` 列和分段配置信息来映射分块在原文中的位置。

## 实现要求

### 1. Python 服务 — 扩展分块接口

修改 `services/python/app/routers/chunks.py`，新增返回原文和分块位置信息：

```
GET /internal/documents/{doc_id}/chunks?kb_id={kb_id}
```

响应扩展为：
```json
{
  "filename": "example.md",
  "extracted_text": "完整的解析后原文...",
  "chunks": [
    {
      "chunk_index": 0,
      "content": "分块文本内容...",
      "char_count": 456,
      "start_offset": 0,
      "end_offset": 456
    },
    {
      "chunk_index": 1,
      "content": "...",
      "char_count": 789,
      "start_offset": 256,
      "end_offset": 1045
    }
  ]
}
```

**位置映射逻辑**：
- 在分段时记录每个 chunk 在原文中的起止位置（字符偏移量）
- 如果是 TASK 007 之前分段的旧数据（没有 offset），fallback 到在原文中搜索 chunk 内容的首次出现位置（`text.indexOf(chunk_content)`）
- 修改 `chunker.py` 的 `make_chunks` 返回值，新增 `start_offset` 和 `end_offset` 字段

**注意**：需要修改 ChromaDB 中存储的 metadata，新增 `start_offset` 和 `end_offset`。对旧数据做兼容处理。

### 2. Node 网关 — 更新代理接口

`services/node/src/routes/documents.ts` 中更新 chunks 代理接口，透传新的响应字段。

### 3. 前端 — 对照预览页面

**新增页面**（`frontend/src/pages/ChunkPreview.tsx`）：
- 路由：`/kb/:kbId/documents/:docId/preview`
- 使用 URL 参数 `docId` 加载数据

**页面布局**：左右分栏，使用 Ant Design 的 Row + Col（各占 50%）

**左栏 — 分段列表**：
- 使用 Ant Design List 组件
- 每个 item 显示：分块序号、字符数、内容预览（截取前 100 字符 + "..."）
- 当前选中的分块有高亮边框（蓝色 border-left 或 background）
- 点击切换选中，右侧同步滚动和高亮
- 默认选中第一个分块

**右栏 — 原文预览**：
- 渲染完整的 `extracted_text`
- 当前选中分块对应的文本区域高亮显示（淡黄色背景 `#fff3b0`，与搜索高亮一致）
- 原文区域设置 `user-select: none`（CSS），禁止选中复制
- 自动滚动到高亮区域（使用 `scrollIntoView`）
- 原文超长时支持滚动（`maxHeight: calc(100vh - 200px), overflow: auto`）

**高亮实现方式**：
- 将原文按 chunk 的 start_offset/end_offset 切分为 segments
- 每个 segment 判断是否属于当前选中的 chunk
- 属于当前 chunk 的 segment 用 `<mark>` 包裹
- 使用 `React.ReactNode[]` 渲染

**导航**：
- 在 `KbDetail.tsx` 的文档列表中，文件名变为可点击链接（`<Link to={/kb/${kbId}/documents/${docId}/preview}>`）
- 页面顶部显示返回按钮（返回知识库详情页）

**API 层**（`frontend/src/api.ts`）更新 `ChunksResponse` 类型：
```typescript
export interface ChunkInfo {
  chunk_index: number;
  content: string;
  char_count: number;
  start_offset?: number;
  end_offset?: number;
}
export interface ChunksResponse {
  filename: string;
  extracted_text: string;
  chunks: ChunkInfo[];
}
```

**修改 App.tsx**：新增路由 `<Route path="/kb/:kbId/documents/:docId/preview" element={<ChunkPreview />} />`

### 不需要做的事

- ❌ 不删除已有的 Modal 分块查看功能（保留作为备用）
- ❌ 不实现分块编辑
- ❌ 不实现 PDF 原文渲染（只展示提取后的文本）

## 验收标准

1. 点击文档文件名进入对照预览页面
2. 左右分栏展示，左侧分段列表，右侧原文预览
3. 点击左侧分段，右侧自动滚动到对应区域并高亮
4. 原文区域不可选中复制
5. 对旧数据（无 offset）也能正常工作（fallback 搜索匹配）
6. 返回按钮正确导航回知识库详情页

## 自我测试

完成实现后，执行以下验证：

1. `cd /Users/tiankx/git_repo/cift/frontend && npm run build` — 前端构建无报错
2. `cd /Users/tiankx/git_repo/cift/services/node && npm run build` — Node 构建无报错
3. `cd /Users/tiankx/git_repo/cift/services/python && python -c "from app.models.schemas import *; from app.services.chunker import make_chunks; print('OK')"` — 无报错
4. 检查 `make_chunks` 返回值包含 start_offset 和 end_offset
5. 构建成功后在回复中确认，并简要说明实现方式
