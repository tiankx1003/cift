# 前端适配 Node Gateway + Docker Compose 全链路联调

## Context

Node Gateway 已搭建完成，提供了 `/api/auth`、`/api/kbs`、`/api/kbs/:kbId/documents`、`/api/kbs/:kbId/search` 等接口。但前端 `api.ts` 仍直连 Python 服务的 `/internal/*` 路由，需要适配到 Node Gateway。同时 Docker Compose 尚未包含 Node 服务和 Nginx。

请先阅读：
- `CLAUDE.md` — 项目约定
- `docs/SPEC.md` — 完整规格（注意 Phase 1 checklist）
- `frontend/src/api.ts` — 当前前端 API 层
- `frontend/src/App.tsx`、`frontend/src/pages/Login.tsx`、`frontend/src/components/BasicLayout.tsx` — 前端页面
- `services/node/src/` — Node Gateway 代码（路由、中间件、配置）
- `docker-compose.yml` — 当前 Docker 配置
- `.env` — 环境变量

## Task 1: 前端 api.ts 适配 Node Gateway

### 1.1 JWT Token 管理

新增 `src/utils/auth.ts`：
- 登录/注册成功后将 token 存入 `localStorage`（key: `cift_token`）
- 提供 `getToken()` / `setToken()` / `removeToken()` 工具函数
- 提供 `getAuthHeaders()` 返回 `{ Authorization: Bearer <token> }`

### 1.2 api.ts 改造

**Base URL**：从 `/internal` 改为 `/api`

**所有请求自动携带 JWT**：在 `request()` 函数中自动注入 Authorization header

**401 处理**：当收到 401 响应时，清除 token 并跳转到 `/login`

**接口路径映射**（对照 Node Gateway 路由）：

| 原路径 | 新路径 |
|--------|--------|
| GET /kbs | GET /api/kbs |
| POST /kbs | POST /api/kbs |
| GET /kbs/:id | GET /api/kbs/:id |
| DELETE /kbs/:id | DELETE /api/kbs/:id |
| GET /kbs/:id/documents | GET /api/kbs/:id/documents |
| DELETE /vectors/:kbId/doc/:docId | DELETE /api/kbs/:kbId/documents/:docId |
| POST /upload | POST /api/kbs/:kbId/documents/upload |
| POST /search | POST /api/kbs/:kbId/search |

**新增认证接口**：
- `login(username, password)` → POST /api/auth/login
- `register(username, password)` → POST /api/auth/register
- `getMe()` → GET /api/auth/me

### 1.3 Login.tsx 对接

将 Login 页面的表单对接到真实 API：
- 调用 `login()` 或 `register()`
- 成功后存储 token，跳转到首页 `/`
- 失败时显示错误信息

### 1.4 BasicLayout.tsx 对接

- 启动时调用 `getMe()` 验证 token 有效性
- 无效则跳转到登录页
- 退出登录时清除 token 并跳转到登录页
- 右上角头像区域显示用户名

## Task 2: Docker Compose 全链路打通

### 2.1 Node 服务 Dockerfile

创建 `services/node/Dockerfile`：
- 基于 node:22-alpine
- 安装依赖 → 编译 TypeScript → 运行

### 2.2 更新 docker-compose.yml

补充以下服务：

```yaml
node-service:
  build: ./services/node
  env_file: .env
  environment:
    DATABASE_URL: postgresql://cift:cift_dev_123@postgres:5432/cift
    PYTHON_SERVICE_URL: http://python-service:8000
    MINIO_ENDPOINT: minio:9000
  depends_on:
    postgres:
      condition: service_healthy
    python-service:
      condition: service_started
    minio:
      condition: service_healthy
  ports:
    - "3000:3000"

nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./infra/nginx/nginx.conf:/etc/nginx/conf.d/default.conf
  depends_on:
    - frontend
    - node-service
```

### 2.3 Nginx 配置

创建 `infra/nginx/nginx.conf`：
- `/` → 转发到 frontend（静态资源）
- `/api/*` → 转发到 node-service:3000
- 静态资源 try_files 支持 SPA history 路由

### 2.4 .env 补充

确保 `.env` 包含 Node 服务所需的所有环境变量：
- `JWT_SECRET`、`JWT_EXPIRES_IN`
- `PYTHON_SERVICE_URL`
- `MINIO_ENDPOINT`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`、`MINIO_BUCKET`

### 2.5 前端 Dockerfile 的 nginx 配置

当前 `frontend/nginx.conf` 需要更新：移除后端代理配置（API 由顶层 nginx 代理），只保留静态资源服务 + SPA fallback。

## Constraints

- **不要修改 Python 服务的代码**
- **不要修改 Node 服务的业务逻辑代码**（如需改配置/环境变量可以）
- 不要引入新的 npm 依赖（使用现有的即可）
- 保持现有功能完整可用

## Acceptance Criteria

- [ ] 前端所有 API 请求走 Node Gateway（`/api/*`）
- [ ] JWT token 自动携带，401 自动跳转登录
- [ ] 登录/注册功能可用
- [ ] 登录后显示用户名，可退出登录
- [ ] 未登录时访问任意页面跳转到登录页
- [ ] `services/node/Dockerfile` 存在且可构建
- [ ] `docker-compose.yml` 包含所有 6 个服务
- [ ] `infra/nginx/nginx.conf` 配置正确
- [ ] `.env` 包含所有必需环境变量
- [ ] 本地开发模式（`npm run dev` 前端 + `npm run dev` Node + Python 直连）仍然可用
