# Node Gateway 实现任务

## Context

CIFT 知识库管理系统，Python 服务和前端已完成，现在需要搭建 Node API Gateway (`services/node/`)。

请先阅读以下文件了解现状：
- `docs/SPEC.md` — 完整项目规格
- `CLAUDE.md` — 当前架构和约定
- `services/python/app/routers/` — Python 服务现有接口
- `services/python/app/models/schemas.py` — 数据结构定义
- `.env` — 环境变量配置

## Goal

在 `services/node/` 下搭建 Express + TypeScript API Gateway，作为前端和 Python 服务之间的中间层。

## What to Build

### 1. 项目脚手架

Express + TypeScript，`package.json` / `tsconfig.json` / `src/` 目录结构：
```
services/node/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── utils/
```

### 2. 认证系统（JWT + bcrypt）

- `POST /api/auth/register` — 注册（username + password）
- `POST /api/auth/login` — 登录，返回 JWT
- `GET /api/auth/me` — 获取当前用户信息（需认证）
- JWT secret 和过期时间从环境变量读取（`JWT_SECRET`, `JWT_EXPIRES_IN`）
- 密码使用 bcrypt，salt rounds = 10

### 3. 知识库 CRUD

`/api/kbs`，所有接口需 JWT 认证：
- `GET /api/kbs` — 获取当前用户的知识库列表
- `POST /api/kbs` — 创建知识库
- `GET /api/kbs/:kbId` — 获取知识库详情
- `PUT /api/kbs/:kbId` — 更新知识库
- `DELETE /api/kbs/:kbId` — 删除知识库

**注意**：Python 服务的 `knowledge_bases` 表当前没有 `user_id`。Node 层需要在 PostgreSQL 中添加 `users` 表和 `knowledge_bases.user_id` 字段，实现数据隔离。

### 4. 文档管理

`/api/kbs/:kbId/documents`：
- `POST .../upload` — 接收 multipart 文件 → 存 MinIO → 调 Python `/internal/parse`
- `GET` — 文档列表
- `DELETE /:docId` — 删除文档（同时调 Python 删除向量）
- `POST /:docId/retry` — 重新解析失败文档

### 5. 搜索

- `POST /api/kbs/:kbId/search` — 转发到 Python `/internal/search`

### 6. 错误处理

统一错误响应格式：
```json
{ "code": 400, "message": "错误描述", "details": null }
```

## Constraints

- Node 服务连接 PostgreSQL（同一个数据库，连接串参考 `.env`）
- 对 Python 服务的调用通过 `PYTHON_SERVICE_URL` 环境变量配置，使用 fetch 转发
- **不要修改 Python 服务的代码**
- **不要修改前端代码**（后续单独适配）
- CORS 开发环境允许 localhost
- 端口 3000

## Acceptance Criteria

- [ ] `npm run dev` 能启动开发服务器
- [ ] 注册、登录、获取用户信息三个认证接口可用
- [ ] 知识库 CRUD 接口可用，有 JWT 认证保护，数据按用户隔离
- [ ] 文件上传接口可用（存 MinIO + 调 Python 解析）
- [ ] 搜索接口可用（转发到 Python）
- [ ] 统一错误处理
