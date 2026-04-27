## 完成状态: ✅ 已完成

# TASK 019: 知识库管理增强

## 目标

完善知识库管理能力，包括统计面板、导入导出、知识库设置等。

## 子任务

### 19.1 知识库统计面板

**目标：** 知识库详情页顶部展示关键统计数据，首页展示全局概览。

**实现要求：**

#### Python 服务
- 新增接口 `GET /internal/knowledge-bases/{kb_id}/stats`
- 返回：文档总数、已分段文档数、chunk 总数、向量总数、总存储大小
- 首页接口 `GET /internal/stats` 返回全局统计（知识库总数、文档总数、chunk 总数）

#### 前端
- 首页统计卡片完善：知识库总数、文档总数、分块总数、存储占用
- 知识库详情页顶部新增统计 Card（Row + Col 布局），使用 `<Statistic>` 组件
- 存储占用自动格式化（B/KB/MB/GB）

#### 涉及层
- 前端 + Python

#### 复杂度
低

---

### 19.2 知识库导出

**目标：** 支持导出知识库的分块数据为 JSON/CSV 格式，方便备份和迁移。

**实现要求：**

#### Python 服务
- 新增 `GET /internal/knowledge-bases/{kb_id}/export?format=json|csv`
- JSON 格式：导出所有 chunk 的 content、metadata、document 信息
- CSV 格式：每行一个 chunk，列包含 content、document_name、chunk_index、score（如有）

#### Node 服务
- 代理导出接口，JWT 保护

#### 前端
- 知识库详情页新增「导出」按钮
- 选择格式后下载文件

#### 涉及层
- 前端 + Node + Python

#### 复杂度
低

---

### 19.3 文档解析状态实时展示

**目标：** 文档上传后，实时展示解析进度状态，提升用户感知。

**实现要求：**

#### 前端
- 文档列表状态 Tag 改进：
  - 处理中 → `<Spin size="small" />` + 橙色文字
  - 完成 → 绿色 Tag
  - 失败 → 红色 Tag，hover 展示 error_message
- 上传多个文件时，自动轮询刷新文档状态（每 3 秒，直到所有文件状态稳定）

#### 涉及层
- 前端

#### 复杂度
低

---

## 执行顺序

按 19.1 → 19.2 → 19.3 顺序执行，均为低复杂度可快速完成。
