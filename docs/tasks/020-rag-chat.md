## 完成状态: ✅ 已完成

# TASK 016: RAG 对话问答

## 目标

在知识库中实现对话式问答功能，基于检索到的上下文让 LLM 生成回答，这是知识库产品的核心价值场景。

## 预设 LLM

- **端点：** `http://host.docker.internal:8000`（Docker 内访问宿主机 MLX 服务）
- **模型名：** `Qwen3.5-9B-MLX-4bit`
- **协议：** OpenAI-compatible（`/v1/chat/completions`）
- **认证：** 无需 API Key
- 作为系统预置的默认对话模型，用户可在模型管理中切换

## 背景

- 已有向量搜索能力（TASK 014 优化）
- 已有 LLM 模型管理（TASK 008）
- 已有 API Key 认证（TASK 015）
- 用户已能上传文档、分段、搜索，但缺少基于知识库的对话能力

## 子任务

### 16.1 对话基础能力

**目标：** 支持用户在知识库内发起多轮对话，系统自动检索相关内容并生成回答。

**实现要求：**

#### Python 服务
- 新增对话管理：
  - `POST /internal/chat` — 对话接口，接收 knowledge_id、message、conversation_id（可选）、搜索参数
  - 流程：query → 向量搜索召回 top-k chunks → 拼装 prompt（system prompt + 召回上下文 + 对话历史）→ 调用 LLM → 流式返回回答
  - LLM 调用复用已有 `services/llm/` 模块
- 新增 `conversations` 表（PostgreSQL）：
  - `id`、`user_id`、`kb_id`、`title`（自动取首条消息摘要）、`created_at`、`updated_at`
- 新增 `conversation_messages` 表：
  - `id`、`conversation_id`、`role`（user/assistant）、`content`、`sources`（JSON，引用的 chunk 列表）、`created_at`
- 支持流式响应（SSE / streaming），前端逐字展示回答
- 回答中标注引用来源（chunk 编号 + 来源文档名）

#### Node 服务
- `POST /api/chat` — 代理对话接口，JWT 保护
- `GET /api/conversations?kb_id=xxx` — 对话列表
- `GET /api/conversations/{id}/messages` — 对话历史
- `DELETE /api/conversations/{id}` — 删除对话

#### 前端
- 知识库详情页新增「对话」Tab（与「文档」「搜索」并列）
- 对话界面：
  - 左侧对话列表（按知识库筛选）
  - 右侧对话区域：消息气泡、输入框、发送按钮
  - Assistant 回答支持 Markdown 渲染
  - 回答下方展示引用来源（可点击跳转分块预览）
  - 支持流式逐字展示
  - 新建对话、删除对话、清空对话

#### 涉及层
- 前端 + Node + Python

#### 复杂度
高

---

### 16.2 对话 Prompt 模板管理

**目标：** 支持自定义对话的 System Prompt，适配不同场景。

**实现要求：**

#### Python 服务
- 新增 `prompt_templates` 表或复用配置：
  - 预置默认模板：知识库问答助手
  - 支持用户自定义模板，模板中可使用变量：`{context}`、`{question}`、`{history}`
- 对话接口接受 `prompt_template_id` 参数

#### 前端
- 管理页新增「Prompt 模板」区域
- 对话界面可选择使用的模板

#### 涉及层
- 前端 + Python

#### 复杂度
低

---

## 执行顺序

先做 16.1（对话基础能力），再做 16.2（Prompt 模板管理）。
