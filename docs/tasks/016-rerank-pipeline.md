## 完成状态: ✅ 已完成

# TASK 017: Rerank 重排序串联

## 目标

将已配置的 Rerank 模型接入搜索流程，对向量召回的结果进行重排序，提升检索准确性。

## 背景

- TASK 008 已实现 Rerank 模型管理（Ollama / OpenAI 兼容 provider）
- TASK 014 已实现搜索参数可调
- 但当前搜索流程仅使用向量相似度，Rerank 模型配置了却未串联

## 实现要求

### Python 服务

- 搜索接口新增 `use_rerank` 参数（bool，默认 false）和 `rerank_model_id` 参数
- 搜索流程改造：
  1. 向量搜索召回 `top_k × 3` 条候选结果（多召回一些用于 rerank）
  2. 如果启用 rerank，调用 Rerank 模型对候选结果重新打分
  3. 按 rerank 分数降序，取 top_k 条返回
- 复用已有 `services/rerank/` 模块
- 如果未配置 Rerank 模型或调用失败，降级为纯向量搜索结果

### Node 服务

- 搜索代理接口透传 `use_rerank`、`rerank_model_id` 参数

### 前端

- 搜索参数面板新增：
  - 「启用重排序」开关
  - 开启后显示 Rerank 模型选择下拉框（从已配置的 Rerank 模型列表获取）
- 搜索结果展示 rerank 分数（如果使用了 rerank）

## 涉及层

- 前端 + Node + Python

## 复杂度

中
