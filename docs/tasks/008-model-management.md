## 完成状态: ✅

# TASK 008: 模型管理

## 目标

在左侧边栏新增「管理」页面，支持管理 LLM、Embedding、Rerank 三类模型的连接配置，替代当前硬编码在环境变量中的模型配置。

## 背景

当前模型配置方式（`services/python/app/utils/config.py`）：
- embedding_provider、embedding_model、ollama_base_url、openai_api_key 等全部通过环境变量
- `services/python/app/services/embedding/factory.py` 根据 embedding_provider 字符串选择 provider
- 没有 rerank 模型支持
- 没有前端管理界面

已有 embedding provider 实现：DummyProvider、MLXProvider、OllamaProvider、LlamaCppProvider、OpenAIProvider。

## 实现要求

### 1. PostgreSQL — 新增模型配置表

在 `services/python/app/services/database.py` 新增 `ModelConfig` 模型：

```python
class ModelConfig(Base):
    __tablename__ = "model_configs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), index=True)  # 所属用户
    model_type: Mapped[str] = mapped_column(String(16))  # "llm" | "embedding" | "rerank"
    provider: Mapped[str] = mapped_column(String(32))     # "ollama" | "openai" | "mlx" | "llama_cpp"
    model_name: Mapped[str] = mapped_column(String(128))
    base_url: Mapped[str] = mapped_column(String(512), default="")
    api_key: Mapped[str] = mapped_column(String(256), default="")
    is_active: Mapped[bool] = mapped_column(default=False)  # 每种类型只能有一个 active
    extra_params: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON 格式的额外参数
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
```

每种 model_type 只允许一个 `is_active=True` 的配置。

### 2. Python 服务 — 模型配置 CRUD

新文件 `services/python/app/routers/model_configs.py`：
```
GET    /internal/models                    # 列表（支持 ?type=embedding 过滤）
POST   /internal/models                    # 创建
PUT    /internal/models/{id}               # 更新
DELETE /internal/models/{id}               # 删除
PUT    /internal/models/{id}/activate      # 设为活跃
GET    /internal/models/active             # 获取所有类型的活跃配置
POST   /internal/models/test               # 测试模型连接
```

**测试连接接口**：
- embedding：调用 embed 一个测试文本，返回维度信息
- llm：调用 chat completions，返回一段回复
- rerank：调用 rerank，返回分数
- 如果连接失败返回错误信息

**修改 embedding factory**：
- `create_embedding_provider` 新增重载，支持从 ModelConfig 记录创建 provider
- 新增 `create_embedding_provider_from_config(config: ModelConfig) -> BaseEmbeddingProvider`

**新增 Rerank Provider**（`services/python/app/services/rerank/`）：
```
services/python/app/services/rerank/
├── __init__.py
├── base.py          # BaseRerankProvider (rerank(query, documents) -> scores)
├── ollama_provider.py
├── openai_provider.py
└── factory.py       # create_rerank_provider_from_config(config)
```

rerank provider 基础接口：
```python
class BaseRerankProvider(ABC):
    @abstractmethod
    async def rerank(self, query: str, documents: list[str], top_k: int = 5) -> list[dict]:
        """返回 [{"index": int, "score": float, "document": str}]"""
        ...
```

### 3. Node 网关 — 代理模型管理接口

新文件 `services/node/src/routes/modelConfigs.ts`：
```
GET    /api/models
POST   /api/models
PUT    /api/models/:id
DELETE /api/models/:id
PUT    /api/models/:id/activate
GET    /api/models/active
POST   /api/models/test
```

全部需要 JWT 认证，数据按 user_id 隔离。

### 4. 前端 — 管理页面

**路由**：`/manage` — 管理页面

**修改 BasicLayout**（`frontend/src/components/BasicLayout.tsx`）：
- 在 `menuRoutes` 中新增「管理」菜单项，路径 `/manage`，图标 `SettingOutlined`

**新增管理页面**（`frontend/src/pages/Manage.tsx`）：
- 使用 Ant Design Tabs 组件，三个 Tab：LLM 模型、Embedding 模型、Rerank 模型
- 每个 Tab 展示该类型的模型配置列表（Table），列：名称、Provider、模型、Base URL、状态（活跃/未激活）、操作
- 操作：编辑、删除、设为活跃、测试连接
- 新增按钮：弹出 Modal 表单创建模型配置
  - 模型类型（Tab 决定，不可选）
  - Provider（下拉：Ollama / OpenAI / MLX / LlamaCpp）
  - 模型名称（输入框）
  - Base URL（输入框，placeholder 提示默认值）
  - API Key（密码输入框）
  - 额外参数（可选，JSON 文本域）
- 测试连接：点击后 loading，成功显示绿色提示 + 模型信息，失败显示红色错误信息
- 设为活跃时，自动将同类型其他配置设为未激活

**API 层**（`frontend/src/api.ts`）新增对应类型定义和请求方法。

**修改 App.tsx**：新增路由 `<Route path="/manage" element={<Manage />} />`

### 不需要做的事

- ❌ 不修改现有的搜索/上传流程来使用 rerank（那是后续优化）
- ❌ 不修改环境变量的默认值机制（环境变量仍作为 fallback）
- ❌ 不实现 LLM 的完整对话功能（只做配置管理和连接测试）

## 验收标准

1. 左侧边栏显示「管理」菜单，点击进入管理页面
2. 三个 Tab 分别展示 LLM / Embedding / Rerank 模型配置
3. 可以创建、编辑、删除模型配置
4. 可以设为活跃，每种类型只能有一个活跃配置
5. 测试连接功能正常，成功/失败有明确反馈
6. 数据按用户隔离，不同用户看不到彼此的配置

## 自我测试

完成实现后，执行以下验证：

1. `cd /Users/tiankx/git_repo/cift/services/python && python -c "from app.models.schemas import *; from app.services.database import *; from app.services.rerank import *; print('OK')"` — 无报错
2. `cd /Users/tiankx/git_repo/cift/services/node && npm run build` — Node 构建无报错
3. `cd /Users/tiankx/git_repo/cift/frontend && npm run build` — 前端构建无报错
4. 检查 `model_configs` 表定义正确，user_id 索引存在
5. 检查 rerank provider 目录结构和 base 接口正确
6. 构建成功后在回复中确认，并简要说明各层实现方式
