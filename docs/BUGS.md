# Bug 跟踪

## 待修复
（暂无）

- [x] 上传文件后弹出"处理失败: null"报错，实际功能正常
  - 原因：Python upload 端点成功时返回 `status: "uploaded"` / 失败时返回 `status: "parse_failed"`，而 schema 注释约定值为 `"completed" | "failed"`。前端 `KbDetail.tsx:128` 判断 `res.status === 'completed'` 永远不成立，走入 else 分支显示 `res.error_message`（成功时为 `null`），导致弹出"处理失败: null"。
  - 修复：将 Python upload 端点的成功 status 改为 `"completed"`，失败 status 改为 `"failed"`，与 schema 约定一致
  - 涉及文件：`services/python/app/routers/upload.py`
  - 注：控制台 `content.js` 的 `Cannot read properties of null (reading '2')` 是第三方库的 CSS 解析错误，与上传逻辑无关

## 已修复
- [x] 知识库详情页显示文档数/分块数/向量数为 0，实际已有数据
  - 原因：Node Gateway 上传文件时调用 Python `/internal/parse`，该端点只写 ChromaDB 向量，不创建 Document 记录也不更新 doc_count。文档列表端点查 PostgreSQL Document 表为空。
  - 修复：Node 上传改为调用 Python `/internal/upload`，由 Python 完成全流程（MinIO 存储 + 解析 + 创建 Document 记录 + 更新 doc_count）
  - 涉及文件：`services/node/src/routes/documents.ts`、`services/node/src/services/pythonClient.ts`

- [x] 登录页 502 Bad Gateway，node-service 启动崩溃
  - 原因：Node 启动时 migration 执行 `ALTER TABLE knowledge_bases ADD COLUMN user_id`，但 `knowledge_bases` 表由 Python 服务创建，Node 先于 Python 启动导致表不存在，migration 崩溃。
  - 修复：db.ts migration 增加表存在性检查；docker-compose 给 python-service 添加 healthcheck，node-service 改为 `condition: service_healthy` 确保建表完成后再启动
  - 涉及文件：`services/node/src/db.ts`、`docker-compose.yml`

- [x] 首页"文档总数"统计卡片显示知识库数量
  - 原因：Home.tsx 中"文档总数"误用 `kbs.length` 而非各 KB 的 `doc_count` 之和
  - 修复：改为 `kbs.reduce((sum, kb) => sum + (kb.doc_count || 0), 0)`
  - 涉及文件：`frontend/src/pages/Home.tsx`
