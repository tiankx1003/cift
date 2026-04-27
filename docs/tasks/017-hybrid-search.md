## 完成状态: ✅ 已完成

# TASK 018: 混合检索（BM25 + 向量）

## 目标

在纯向量检索的基础上引入 BM25 关键词检索，通过加权融合两种检索结果，提升召回率和准确性。

## 背景

- 当前仅支持向量语义搜索
- 对于精确关键词匹配场景（如专有名词、编号、代码片段），向量搜索效果不如传统关键词搜索
- TASK 014 已预留向量权重参数 `vector_weight`，但尚未实现混合检索

## 实现要求

### Python 服务

- 新增 BM25 索引：
  - 使用 `rank_bm25` 或 `jieba` + 自实现 BM25（避免引入重依赖）
  - 文档分段时同步更新 BM25 索引（将 chunk 文本加入索引）
  - BM25 索引按知识库隔离
- 搜索接口改造：
  - 新增 `search_mode` 参数：`vector`（纯向量，默认）、`bm25`（纯关键词）、`hybrid`（混合）
  - 混合模式：分别执行向量搜索和 BM25 搜索，按 `vector_weight` 加权融合分数
  - 融合公式：`final_score = vector_weight × vector_score + (1 - vector_weight) × normalized_bm25_score`
  - BM25 分数需归一化到 0-1 区间（min-max 归一化）
- 新增依赖（`pyproject.toml`）：`jieba`（中文分词，BM25 需要）

### Node 服务

- 搜索代理接口透传 `search_mode` 参数

### 前端

- 搜索参数面板新增「检索模式」选择：
  - 语义搜索（向量）
  - 关键词搜索（BM25）
  - 混合搜索（默认选中混合时显示向量权重滑块）
- 混合模式下，`vector_weight` 滑块生效（TASK 014 已预留）

## 涉及层

- 前端 + Node + Python

## 复杂度

中
