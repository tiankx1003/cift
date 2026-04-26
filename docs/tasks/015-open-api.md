## 完成状态: 🔄 进行中

### 15.2 统一 API 响应格式 + 错误码 ✅ 已完成（新接口使用统一格式，旧接口渐进迁移）

### 15.4 API Key 管理 ✅ 已完成

### 15.1 补齐缺失接口 ✅ 已完成（大部分接口已在前期 Task 中实现，本轮确认无遗漏）

### 15.3 API 文档 ✅ 已完成

# TASK 015: 开放接口能力

## 目标

补齐 API 接口，统一响应格式和错误码，输出 API 文档，支持 API Key 认证，并提供兼容 Dify 外部知识库的检索接口。

## 参考文档

- **Dify 外部知识库 API 规范**：`docs/inference/dify-external-knowledge-api.md`
  - 实现前必须阅读此文档，CIFT 的 `/retrieval` 接口需兼容此规范
  - 核心要点：`POST /retrieval`，请求包含 `knowledge_id`、`query`、`retrieval_setting`（top_k、score_threshold），返回 `records` 数组（content、score、title、metadata）

## 子任务

### 15.1 补齐缺失接口

**目标：** 梳理现有功能，补齐前端已使用但 Node 层未暴露的接口，以及外部调用所需的接口。

**当前已有接口：**
- 认证：注册、登录、获取用户信息
- 知识库：CRUD
- 文档：列表、上传、删除

**需补齐：**
- 分段相关：
  - `POST /api/documents/{doc_id}/chunk` — 触发分段
  - `GET /api/documents/{doc_id}/chunk-progress` — 查询分段进度
- 分段配置：
  - `GET /api/chunk-configs` — 列表
  - `POST /api/chunk-configs` — 创建
  - `PUT /api/chunk-configs/{id}` — 更新
  - `DELETE /api/chunk-configs/{id}` — 删除
- 模型配置：
  - `GET /api/model-configs` — 列表（支持 type 过滤：llm/embedding/rerank）
  - `POST /api/model-configs` — 创建
  - `PUT /api/model-configs/{id}` — 更新
  - `DELETE /api/model-configs/{id}` — 删除
  - `POST /api/model-configs/{id}/test` — 测试连接
- 搜索：
  - `POST /api/search` — 语义搜索（POST 以支持复杂参数）
- 分块：
  - `GET /api/documents/{doc_id}/chunks` — 查看分块列表
  - `GET /api/documents/{doc_id}/chunks/{chunk_id}` — 查看单个分块
- Dify 兼容检索：
  - `POST /api/retrieval` — 兼容 Dify 外部知识库 API 规范的检索接口（详见 15.5）

**实现要求：**
- 所有接口 JWT 保护 + 用户隔离（`/api/retrieval` 除外，使用 API Key 认证）
- 统一请求/响应格式（见 15.2）

#### 涉及层
- Node（主要）+ Python（可能需要新增部分 internal 接口）

#### 复杂度
中

---

### 15.2 统一 API 响应格式 + 错误码规范

**目标：** 规范所有接口的响应结构和错误码，方便外部集成。

**实现要求：**

#### 统一响应格式

成功：
```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

列表（分页）：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

错误：
```json
{
  "code": 40001,
  "message": "知识库不存在",
  "details": null
}
```

#### 错误码规范

| 范围 | 含义 |
|------|------|
| 0 | 成功 |
| 40001-40099 | 参数错误 |
| 40101-40199 | 认证/权限错误 |
| 40401-40499 | 资源不存在 |
| 40901-40999 | 冲突（如重复创建） |
| 50001-50099 | 服务端内部错误 |

#### 涉及层
- Node（统一响应中间件）

#### 复杂度
低

---

### 15.3 API 文档

**目标：** 输出完整的 OpenAPI/Swagger 文档，方便外部开发者查阅。

**实现要求：**

#### Node 服务
- 集成 `swagger-ui-express` + `swagger-jsdoc`
- 在路由中添加 JSDoc 注释自动生成 API 文档
- 访问 `/api/docs` 查看 Swagger UI
- 包含所有接口的请求参数、响应示例、错误码说明

#### 涉及层
- Node

#### 复杂度
低

---

### 15.4 API Key 管理

**目标：** 支持独立于 JWT 的 API Key 认证方式，方便外部系统调用接口。

**实现要求：**

#### 数据库
- 新增 `api_keys` 表：
  - `id`、`user_id`（关联用户）、`key`（自动生成，如 `ck-xxxxxxxx`）、`name`（备注名）、`created_at`、`last_used_at`、`is_active`

#### Node 服务
- 新增 API Key 管理 CRUD：
  - `POST /api/api-keys` — 创建 API Key（返回完整 key，仅此一次展示）
  - `GET /api/api-keys` — 列表（key 脱敏显示，如 `ck-****abcd`）
  - `DELETE /api/api-keys/{id}` — 删除/禁用
- 认证中间件：请求头 `Authorization: Bearer ck-xxxxxxxx` 或 `X-API-Key: ck-xxxxxxxx`
- API Key 认证与 JWT 认证并存，任一通过即可

#### 前端
- 管理页新增「API Keys」区域，支持创建、查看、删除

#### 涉及层
- 前端 + Node + PostgreSQL

#### 复杂度
中

---

### 15.5 Dify 兼容检索接口

**目标：** 实现 `POST /retrieval` 接口，兼容 Dify 外部知识库 API 规范，使 CIFT 可作为 Dify 的外部知识源。

**参考文档：** `docs/inference/dify-external-knowledge-api.md`（实现前必须阅读）

**接口规范：**

```
POST /api/retrieval
Content-Type: application/json
Authorization: Bearer {API_KEY}
```

#### 请求体

```json
{
    "knowledge_id": "kb-uuid",
    "query": "搜索内容",
    "retrieval_setting": {
        "top_k": 3,
        "score_threshold": 0.5
    },
    "metadata_condition": {
        "logical_operator": "and",
        "conditions": [
            {"name": "file_type", "comparison_operator": "is", "value": "pdf"}
        ]
    }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `knowledge_id` | 是 | CIFT 知识库 ID，用于路由到正确的知识库 |
| `query` | 是 | 搜索查询文本 |
| `retrieval_setting.top_k` | 是 | 返回结果最大数量 |
| `retrieval_setting.score_threshold` | 是 | 最低相似度分数（0-1），0.0 表示不过滤 |
| `metadata_condition` | 否 | 元数据筛选条件，MVP 阶段可忽略 |

#### 响应体

```json
{
    "records": [
        {
            "content": "检索到的文本分段内容",
            "score": 0.98,
            "title": "文档名.pdf",
            "metadata": {
                "source": "文档名.pdf",
                "chunk_index": 3
            }
        }
    ]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `records` | 是 | 结果数组，无匹配时返回空数组 |
| `records[].content` | 是 | 分段文本内容 |
| `records[].score` | 是 | 相似度分数（0-1） |
| `records[].title` | 是 | 源文档标题/文件名 |
| `records[].metadata` | 是 | 元数据对象，**不能为 null** |

#### 错误响应

```json
{
    "error_code": 2001,
    "error_msg": "知识库不存在"
}
```

| 错误码 | 用途 |
|--------|------|
| 1001 | 无效的 Authorization 请求头格式 |
| 1002 | 认证失败（API Key 无效） |
| 2001 | 知识库不存在 |

**实现要求：**

#### Python 服务
- 新增 `POST /internal/retrieval` 内部接口
- 接收 knowledge_id、query、top_k、score_threshold
- 在对应知识库的 ChromaDB collection 中执行向量搜索
- 按 score_threshold 过滤，按 score 降序返回 top_k 条结果
- 将 ChromaDB 的 chunk 数据映射为 Dify 要求的 records 格式

#### Node 服务
- 新增 `POST /api/retrieval` 路由
- 仅通过 API Key 认证（不走 JWT）
- 通过 knowledge_id 查找对应用户的知识库（API Key 关联 user_id，确保数据隔离）
- 代理到 Python `/internal/retrieval`

#### 涉及层
- Python + Node

#### 复杂度
中

---

## 执行顺序

建议按 15.2 → 15.4 → 15.1 → 15.3 → 15.5 顺序执行。
- 15.2 先统一格式规范
- 15.4 API Key 基础设施（后续 retrieval 接口依赖）
- 15.1 补齐其余接口
- 15.3 接口补齐后生成文档
- 15.5 最后实现 Dify 兼容检索接口
