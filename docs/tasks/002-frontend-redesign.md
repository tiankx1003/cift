# 前端 UI 重构任务 — Ant Design Pro 风格

## Context

CIFT 知识库管理系统前端目前是简单的裸页面（无导航、无布局框架），需要重构为 Ant Design Pro 风格的管理后台布局。

请先阅读：
- `CLAUDE.md` — 项目约定
- `src/App.tsx`、`src/pages/Home.tsx`、`src/pages/KbDetail.tsx`、`src/api.ts` — 现有代码
- Ant Design Pro 布局参考：https://preview.pro.ant.design

## Goal

将当前前端重构为标准的**顶栏 + 侧边栏**管理后台布局，视觉风格参考 Ant Design Pro。

## 需要安装的依赖

```bash
npm install @ant-design/pro-components @ant-design/cssinjs
```

## What to Build

### 1. 整体布局（App Shell）

使用 `@ant-design/pro-layout` 的 `ProLayout` 组件搭建整体框架：

**顶栏（Header）：**
- 左上角：CIFT Logo + 项目名
- 顶部导航菜单（当前只有"知识库"一个模块，但预留扩展能力）
- 右上角：用户头像 + 下拉菜单（个人设置、退出登录等占位即可，后续对接 Node Gateway 认证）

**侧边栏（Sider）：**
- 当前知识库模块的子菜单：
  - 知识库列表（首页）
  - （后续可扩展：文档管理、搜索中心等）

**内容区：**
- 面包屑导航
- 现有页面内容渲染在此区域

### 2. 知识库列表页重构（Home.tsx）

将现有的卡片列表升级为更精致的设计：
- 顶部统计卡片区域（知识库总数、文档总数等，数据可先 mock 或从 API 计算）
- 知识库卡片增加图标/封面色块（根据名称 hash 生成不同颜色）
- 卡片 hover 效果更明显
- 新建知识库的 Modal 保持功能不变，样式微调

### 3. 知识库详情页重构（KbDetail.tsx）

将现有的三个 Card（上传、文档、搜索）重新组织：
- 页面顶部：知识库名称 + 统计信息（文档数、分块数）
- 左侧/上方：上传区域 + 文档列表
- 右侧/下方：搜索区域（搜索结果展示优化，增加相似度进度条可视化）
- 文档列表增加文件类型图标区分

### 4. 登录/注册页

新增一个简洁的登录页（`pages/Login.tsx`）：
- 居中的登录卡片，背景使用渐变色或几何图案
- 用户名 + 密码表单
- 注册链接
- 暂时不需要对接后端，预留 API 调用即可

### 5. 路由更新

```
/login        → Login 页面（无侧边栏）
/             → 知识库列表（有侧边栏）
/kb/:kbId     → 知识库详情（有侧边栏）
```

## Constraints

- **不要修改 `api.ts`** 中的接口定义和调用逻辑（API 层后续对接 Node Gateway 时统一改）
- **不要修改 Python 服务和 Node 服务**
- 保持现有功能完整：知识库 CRUD、文件上传、搜索
- 使用 Ant Design 6（已在 dependencies 中）+ Pro Components
- 响应式：移动端侧边栏可折叠
- 中文界面

## Design Details

### 配色方案
- 主色：`#1677ff`（Ant Design 默认蓝）
- 侧边栏：深色 `#001529`
- 背景：`#f5f5f5`

### 字体
- 使用系统默认字体栈，无需额外引入

### 间距
- 内容区 padding：`24px`
- 卡片间距：`16px`
- 使用 Ant Design 的 token 系统保持一致性

## Acceptance Criteria

- [ ] ProLayout 搭建完成，顶栏 + 侧边栏 + 内容区布局正确
- [ ] 顶栏有 Logo、导航、用户头像
- [ ] 侧边栏有知识库模块子菜单
- [ ] 登录页独立布局（无侧边栏）
- [ ] 知识库列表页功能正常，视觉升级
- [ ] 知识库详情页功能正常，布局优化
- [ ] 移动端响应式正常
- [ ] `npm run dev` 启动无报错
