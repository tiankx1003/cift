## 完成状态: ✅ 已完成

# TASK 020: 文件格式扩展 + 文档在线预览

## 目标

扩展支持的文件类型（CSV、JSON），并新增文档在线预览功能，减少上下文切换。

## 子任务

### 20.1 CSV/JSON 文件支持

**目标：** 支持上传和解析 CSV、JSON 结构化数据文件。

**实现要求：**

#### Python 服务
- 新增 `CsvParser`：
  - 使用 Python 标准库 `csv` 模块
  - 按行分块，每行作为一个 chunk，表头信息作为每个 chunk 的前缀
  - 支持 `chunk_size` 控制每个 chunk 包含的行数
- 新增 `JsonParser`：
  - 数组型 JSON（`[{...}, {...}]`）：每个元素作为一个 chunk
  - 对象型 JSON（`{key: value}`）：按 key-value 对分组为 chunk
  - 嵌套 JSON：递归展平后再分块
- 注册到解析器工厂（`parser/__init__.py`）

#### Node 服务
- `documents.ts` 扩展 `ALLOWED_EXTENSIONS` 和 `MIME_MAP`（`.csv` → `text/csv`，`.json` → `application/json`）

#### 前端
- Upload 组件 `accept` 属性添加 `.csv,.json`
- 按钮文案更新

#### 涉及层
- Python + Node + 前端

#### 复杂度
中

---

### 20.2 文档在线预览

**目标：** 在知识库详情页直接预览文档内容，无需下载。

**实现要求：**

#### Python 服务
- 新增 `GET /internal/documents/{doc_id}/preview`
- 返回文档的 `extracted_text`（已在上传时提取存储）

#### Node 服务
- 代理预览接口

#### 前端
- 文档列表操作列新增「预览」按钮
- 点击后打开 Modal 或跳转到预览页面
- 预览内容支持：
  - 纯文本：直接展示，等宽字体
  - Markdown：渲染为 HTML（使用 `react-markdown`）
  - PDF/DOCX：展示提取的纯文本内容（提示用户这是解析后的文本）
- 支持全文搜索高亮（在预览内容中搜索关键词）

#### 涉及层
- 前端 + Node + Python

#### 复杂度
中

---

## 执行顺序

先做 20.1（文件格式扩展），再做 20.2（文档在线预览）。
