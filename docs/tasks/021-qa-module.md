## 完成状态: ✅ 已完成

# TASK 021: 智能问答模块（对话功能重构）

## 目标

将对话功能从知识库详情页中剥离，独立为"智能问答"顶级功能模块，支持自主选择知识库（多选），也可不选直接调用模型。

## 背景

- 当前对话功能（`/kb/:kbId/chat`）嵌套在知识库详情页内，绑定单个知识库（TASK 016）
- 需要独立的问答入口，支持跨知识库检索和纯模型对话

## 子任务

### 21.1 侧边栏与路由

**目标：** 新增"智能问答"顶级菜单项。

**实现要求：**

- 菜单顺序：知识库 → 知识图谱 → **智能问答** → 管理
- 路由：`/qa`
- 图标：`MessageOutlined` 或 `CommentOutlined`
- 修改文件：`frontend/src/components/BasicLayout.tsx`、`frontend/src/App.tsx`

### 21.2 后端 API（Node Service）

**目标：** 新增独立的 QA 对话路由。

**实现要求：**

- 新建 `services/node/src/routes/qa.ts`，路由 `/api/qa/*`
- 所有路由需 JWT 认证
- 接口列表：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/qa/sessions` | 创建对话（无需绑定 kb_id） |
| GET | `/api/qa/sessions` | 列出当前用户所有对话 |
| PATCH | `/api/qa/sessions/:id` | 修改对话名称 |
| DELETE | `/api/qa/sessions/:id` | 删除对话及其消息 |
| GET | `/api/qa/sessions/:id/messages` | 获取对话消息列表 |
| POST | `/api/qa/sessions/:id/messages` | 发送消息（SSE 流式响应） |

- 请求体携带 `kb_ids: string[]`（可选，知识库 ID 列表）
- 注册路由到 `services/node/src/index.ts`

### 21.3 后端逻辑（Python Service）

**目标：** 实现 QA 对话的核心逻辑，支持多知识库检索和纯模型对话。

**实现要求：**

- 新建 `services/python/app/routers/qa.py`，路由 `/internal/qa/*`
- 对话 session 不绑定 kb_id，改为消息级别携带 kb_ids
- 检索逻辑：遍历 kb_ids 对应的 ChromaDB collection，合并召回结果
- 不选知识库时：跳过检索，直接调用 LLM
- SSE 流式输出
- 复用现有 LLM 调用逻辑（`services/python/app/routers/chat.py` 中的 RAG 链路）

### 21.4 数据库

**目标：** 新建 QA 对话相关表，保留旧表不动。

**实现要求：**

- 新建 `qa_sessions` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| user_id | UUID FK | 关联用户 |
| title | VARCHAR | 对话标题 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

- 新建 `qa_messages` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | 主键 |
| session_id | UUID FK | 关联对话 |
| role | VARCHAR | user / assistant / system |
| content | TEXT | 消息内容 |
| sources | JSONB | 引用来源 |
| kb_ids | UUID[] | 本次消息关联的知识库 |
| created_at | TIMESTAMP | 创建时间 |

- 保留原有 `chat_sessions` / `chat_messages` 表不动（旧对话功能仍可用）

### 21.5 前端页面

**目标：** 实现智能问答完整 UI。

**实现要求：**

- 新建 `frontend/src/pages/QA.tsx`
- 布局：左侧对话列表 + 右侧对话区域
- 对话列表：新建、重命名、删除（带确认）
- 对话区域：气泡展示（Markdown 渲染）、加载态、引用来源展示
- 知识库多选组件（Select mode=multiple），位于对话顶部
- 输入框支持 `/` 命令呼出知识库召回内容
- 新增 API 函数到 `frontend/src/api.ts`

## 技术方案

- Node ↔ Python 通信使用 `/internal/*` 路由
- 前端 ↔ Node 使用 `/api/*` 路由，JWT Bearer 认证
- 对话回复使用 SSE 流式输出
- 前端使用 React 19 + Ant Design 6 + TypeScript

## 约束

- 不删除旧对话功能，保持 `/kb/:kbId/chat` 可用
- Python 用绝对导入 `from app.xxx import ...`
- Node 用相对导入 `from './xxx.js'`
- 遵循现有项目架构和代码风格

## 参考代码

- 现有对话功能：`services/node/src/routes/chat.ts`、`services/python/app/routers/chat.py`、`frontend/src/pages/Chat.tsx`
- 前端布局：`frontend/src/components/BasicLayout.tsx`
- API 客户端：`frontend/src/api.ts`
- 数据库 ORM：`services/python/app/services/database.py`
- Node DB 连接：`services/node/src/db.js`

## 验收标准

1. 侧边栏正确显示"智能问答"，位于"知识图谱"和"管理"之间
2. 可新建、重命名、删除对话
3. 可在对话中选择 0~N 个知识库
4. 不选知识库时，LLM 直接回复
5. 选择知识库后，RAG 模式正常工作，展示引用来源
6. SSE 流式输出正常
7. `/` 命令可呼出知识库召回内容
8. 旧对话功能（`/kb/:kbId/chat`）不受影响
