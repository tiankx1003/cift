# TASK 001: 搜索结果关键词高亮

## 目标

在知识库详情页的语义搜索结果中，对用户搜索关键词在 chunk 文本里做高亮标记。

## 背景

- 搜索流程：用户在 `KbDetail.tsx` 输入查询 → `api.search()` → Node 代理 → Python → ChromaDB → 返回 `{ results: [{ chunk_id, content, score, metadata }] }`
- 当前搜索结果中 `item.content` 纯文本直接渲染，无高亮
- API 返回类型定义在 `frontend/src/api.ts`：`SearchResult { chunk_id, content, score, metadata: { doc_id, chunk_index } }`

## 实现要求

### 仅修改前端

- `frontend/src/pages/KbDetail.tsx` — 唯一需要修改的文件
- 不修改后端、不修改 API 接口、不添加新依赖

### 高亮逻辑

1. 在 `KbDetail.tsx` 文件内新增工具函数：

```tsx
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ background: '#fff3b0', padding: '0 2px', borderRadius: 2 }}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}
```

> **注意**：`split` + `regex.test` 组合有 bug（test 消耗 lastIndex 导致状态不一致）。请改用更安全的方式实现，比如遍历 parts 时用 `part.toLowerCase() === query.toLowerCase()` 判断，或用 `React.useMemo` 缓存 regex 避免状态问题。

2. 将搜索结果渲染处的：
```tsx
<Paragraph style={{ margin: 0, color: '#333' }}>{item.content}</Paragraph>
```
改为：
```tsx
<Paragraph style={{ margin: 0, color: '#333' }}>{highlightText(item.content, query)}</Paragraph>
```

### 样式

- 使用 `<mark>` 标签，内联样式 `background: '#fff3b0'; padding: '0 2px'; borderRadius: 2`（淡黄色背景）

## 验收标准

1. 搜索关键词在 chunk 文本中出现时，有黄色高亮背景
2. 大小写不敏感：搜索 "python" 能高亮 "Python"、"PYTHON"
3. 搜索词为空时正常显示原文
4. chunk 中不含搜索词时正常显示原文（语义搜索可能匹配到语义相近但用词不同的内容，不高亮即可）
5. 不影响现有搜索功能，`npm run build` 无报错

## 自我测试

完成实现后，执行以下验证：

1. `cd /Users/tiankx/git_repo/cift/frontend && npm run build` — 确保构建无报错无警告
2. 构建成功后在回复中确认，并简要说明实现方式
