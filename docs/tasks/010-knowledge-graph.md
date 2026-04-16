## 完成状态: ✅

# TASK 010: 知识图谱

## 目标

在左侧边栏新增「知识图谱」入口，进入后支持选择已有知识库，系统自动从文档中抽取实体和关系，构建并可视化展示知识图谱。

## 背景

- 知识库中已有文档的分块数据（ChromaDB）
- TASK 008 新增了 LLM 模型管理，可以配置 LLM 用于实体抽取
- 当前没有图数据库和图谱可视化组件

## 技术选型

- **图存储**：使用 NetworkX（Python 图库）在内存中构建图，序列化为 JSON 存储到 PostgreSQL（新建 `knowledge_graphs` 表，`graph_data` JSON 列）。MVP 阶段不引入 Neo4j 等专用图数据库。
- **实体抽取**：调用 LLM API（OpenAI 兼容格式）从文档 chunk 中抽取实体和关系
- **前端可视化**：使用 `@ant-design/graphs`（Ant Design 生态的图谱组件，基于 G6），与现有 Ant Design 风格一致

## 实现要求

### 1. Python 服务

**新增依赖**（`pyproject.toml`）：`networkx`

**PostgreSQL 新增表**（`database.py`）：
```python
class KnowledgeGraph(Base):
    __tablename__ = "knowledge_graphs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    kb_id: Mapped[str] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    node_count: Mapped[int] = mapped_column(Integer, default=0)
    edge_count: Mapped[int] = mapped_column(Integer, default=0)
    graph_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: {"nodes": [...], "edges": [...]}
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending / building / completed / failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
```

**新增 LLM 客户端**（`services/python/app/services/llm/`）：
```
services/python/app/services/llm/
├── __init__.py
├── base.py          # BaseLLMClient - async chat(messages) -> str
├── openai_client.py # OpenAI 兼容 API 客户端
└── factory.py       # create_llm_client_from_config(config: ModelConfig)
```

LLM 客户端调用 OpenAI 兼容的 `/v1/chat/completions` 接口，支持配置 base_url 和 api_key。

**实体抽取 Prompt**（在 llm 模块中定义）：
```
从以下文本中抽取实体和关系，以 JSON 格式返回。
实体类型包括：人物、组织、地点、概念、事件、产品。
输出格式：
{"entities": [{"id": "e1", "name": "实体名", "type": "类型"}], "relations": [{"source": "e1", "target": "e2", "label": "关系描述"}]}
只返回 JSON，不要其他内容。

文本：
{chunk_content}
```

**图谱构建接口**（新文件 `routers/knowledge_graphs.py`）：
```
POST   /internal/kbs/{kb_id}/knowledge-graphs              # 创建并开始构建
GET    /internal/kbs/{kb_id}/knowledge-graphs              # 列表
GET    /internal/kbs/{kb_id}/knowledge-graphs/{id}         # 获取图谱数据（含 nodes/edges）
DELETE /internal/kbs/{kb_id}/knowledge-graphs/{id}         # 删除
```

**构建流程**（`POST` 创建时异步执行）：
1. 获取该知识库的所有文档 chunks（从 ChromaDB 查询）
2. 获取活跃的 LLM 配置（从 model_configs 表）
3. 如果没有活跃 LLM，返回错误提示「请先配置 LLM 模型」
4. 遍历 chunks（限制最多 50 个 chunk，避免 token 过多），调用 LLM 抽取实体和关系
5. 使用 NetworkX 合并去重（同名实体合并，累积边）
6. 序列化为 JSON 存入 `graph_data`
7. 更新 status 为 completed，记录 node_count 和 edge_count
8. 构建失败时 status 设为 failed，记录 error_message

**构建优化**：
- 批量处理 chunks，每个请求包含 3-5 个 chunks 的文本（减少 LLM 调用次数）
- 设置超时，单个 chunk 抽取超过 30 秒跳过
- 使用 `asyncio.gather` 并发调用 LLM（限制并发数 5）

### 2. Node 网关

新文件 `services/node/src/routes/knowledgeGraphs.ts`：
```
POST   /api/kbs/:kbId/knowledge-graphs
GET    /api/kbs/:kbId/knowledge-graphs
GET    /api/kbs/:kbId/knowledge-graphs/:id
DELETE /api/kbs/:kbId/knowledge-graphs/:id
```

JWT 认证 + 用户隔离。

### 3. 前端

**安装依赖**：`npm install @ant-design/graphs`

**修改 BasicLayout**（`BasicLayout.tsx`）：
- `menuRoutes` 新增「知识图谱」菜单项，路径 `/graph`，图标 `ApartmentOutlined`（或 `ShareAltOutlined`）

**新增页面**（`frontend/src/pages/KnowledgeGraph.tsx`）：
- 路由：`/graph`
- 页面布局：
  - 顶部：知识库选择器（Select 下拉框，列出用户所有知识库）
  - 操作区：「生成图谱」按钮、已有图谱列表
  - 图谱展示区：使用 `@ant-design/graphs` 的 `Graphin` 或 `KnowledgeGraph` 组件
- 选择知识库后：
  - 如果该 KB 已有图谱，直接展示
  - 如果没有，显示「生成图谱」按钮
- 点击「生成图谱」：
  - 调用 POST 创建图谱
  - 显示 loading 状态（因为构建可能耗时较长，显示进度提示）
  - 构建完成后自动展示图谱
- 图谱交互：
  - 节点可拖拽、缩放
  - 点击节点高亮相关边
  - 节点颜色按实体类型区分（人物蓝色、组织绿色、地点橙色、概念紫色、事件红色、产品青色）
  - 边上显示关系标签
  - 图例（Legend）展示实体类型颜色映射

**API 层**（`api.ts`）新增类型和请求方法。

**修改 App.tsx**：新增路由 `<Route path="/graph" element={<KnowledgeGraph />} />`

### 不需要做的事

- ❌ 不引入 Neo4j（MVP 阶段用 NetworkX + PostgreSQL JSON）
- ❌ 不实现增量更新图谱（每次重新构建）
- ❌ 不实现图谱编辑功能
- ❌ 不实现从图谱节点跳转到文档分块（后续优化）

## 验收标准

1. 左侧边栏显示「知识图谱」菜单
2. 可以选择知识库并生成图谱
3. 图谱可视化正常展示，节点可拖拽、缩放
4. 不同实体类型有不同颜色
5. 点击节点高亮相关关系
6. 构建进度有 loading 提示
7. 未配置 LLM 时给出明确提示

## 自我测试

完成实现后，执行以下验证：

1. `cd /Users/tiankx/git_repo/cift/services/python && python -c "from app.services.llm import *; from app.services.database import *; print('OK')"` — 无报错
2. `cd /Users/tiankx/git_repo/cift/services/node && npm run build` — Node 构建无报错
3. `cd /Users/tiankx/git_repo/cift/frontend && npm run build` — 前端构建无报错
4. 检查 `knowledge_graphs` 表定义正确
5. 检查 `@ant-design/graphs` 已加入前端依赖
6. 构建成功后在回复中确认，并简要说明各层实现方式
