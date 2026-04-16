# Task: 新增 PDF 和 Word（docx）解析支持

## 背景

当前 CIFT 的 parser 模块只支持 `.txt` 和 `.md` 两种纯文本格式。需要新增 PDF 和 Word（docx）解析，覆盖最常见的文档类型。

## 现有架构

解析器采用 Provider 抽象模式：

- `services/python/app/services/parser/base.py` — `BaseParser` 抽象基类，定义 `parse(content: bytes) -> str`
- `services/python/app/services/parser/txt_parser.py` — TxtParser
- `services/python/app/services/parser/markdown_parser.py` — MarkdownParser
- `services/python/app/services/parser/__init__.py` — `_parsers` 字典注册 + `get_parser()` 工厂函数
- `services/python/app/routers/upload.py` — 上传路由，`ALLOWED_EXTENSIONS` 和 `MIME_MAP` 控制允许的文件类型

解析后的文本统一走 `chunker.py` 分块 → embedding → ChromaDB 存储，下游不需要改动。

## 要求

### 1. 新增 PDF 解析器

- 文件：`services/python/app/services/parser/pdf_parser.py`
- 依赖：**PyMuPDF**（`pymupdf`，import as `fitz`）
  - 轻量、纯 Python、无需系统依赖，适合容器化
  - 提取文本：逐页 `page.get_text()`
- 注册为 `"pdf"` 类型

### 2. 新增 Word 解析器

- 文件：`services/python/app/services/parser/docx_parser.py`
- 依赖：**python-docx**
- 提取所有段落的文本，用换行符连接
- 注册为 `"docx"` 类型

### 3. 更新注册与路由

- `parser/__init__.py`：在 `_parsers` 字典中注册 `PdfParser` 和 `DocxParser`
- `upload.py`：扩展 `ALLOWED_EXTENSIONS` 和 `MIME_MAP`
  - `.pdf` → `application/pdf`
  - `.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- 不需要改 `.doc`（旧格式），仅支持 `.docx`

### 4. 依赖管理

- 在 `services/python/pyproject.toml` 中添加 `pymupdf` 和 `python-docx`
- 在 `services/python/Dockerfile` 中确保 `uv sync` 会安装新依赖（应该已自动包含）

### 5. 约束

- 沿用 `BaseParser` 抽象，不改变接口签名
- 解析失败时抛出明确异常，由 upload 路由的 try-catch 处理（已有）
- 不改 chunker、embedding、ChromaDB 等下游逻辑
- PDF 中图片内容忽略，只提取文本
- 不需要支持扫描版 PDF（OCR），纯文本 PDF 即可

## 验收标准

1. `uv sync` 成功安装新依赖
2. 上传 `.pdf` 文件 → 解析出文本 → 分块 → embedding → 搜索能命中
3. 上传 `.docx` 文件 → 同上
4. 上传 `.doc` 或其他不支持的格式 → 返回 400 错误
5. `docker compose up --build` 构建成功
