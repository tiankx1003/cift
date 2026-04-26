import { Router, Request, Response } from 'express';
import { apiKeyAuth, anyAuth } from '../middleware/apiKeyAuth.js';
import { pythonClient } from '../services/pythonClient.js';
import { pool } from '../db.js';

export const retrievalRouter = Router();

/**
 * @openapi
 * /retrieval:
 *   post:
 *     tags: [Retrieval]
 *     summary: Dify 兼容检索接口
 *     description: 兼容 Dify 外部知识库 API 规范，支持 API Key 认证
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [knowledge_id, query, retrieval_setting]
 *             properties:
 *               knowledge_id:
 *                 type: string
 *                 description: CIFT 知识库 ID
 *               query:
 *                 type: string
 *                 description: 搜索查询文本
 *               retrieval_setting:
 *                 type: object
 *                 required: [top_k, score_threshold]
 *                 properties:
 *                   top_k: { type: integer, description: "返回结果最大数量" }
 *                   score_threshold: { type: number, description: "最低相似度分数 (0-1)" }
 *               metadata_condition:
 *                 type: object
 *                 description: 元数据筛选条件（MVP 阶段忽略）
 *     responses:
 *       200:
 *         description: 检索结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 records:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       content: { type: string }
 *                       score: { type: number }
 *                       title: { type: string }
 *                       metadata: { type: object }
 *       401:
 *         description: 认证失败
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error_code: { type: integer }
 *                 error_msg: { type: string }
 */
retrievalRouter.post('/', apiKeyAuth, anyAuth, async (req: Request, res: Response) => {
  const { knowledge_id, query, retrieval_setting } = req.body;

  // Validate required fields
  if (!knowledge_id) {
    res.status(400).json({ error_code: 1001, error_msg: 'knowledge_id is required' });
    return;
  }
  if (!query) {
    res.status(400).json({ error_code: 1001, error_msg: 'query is required' });
    return;
  }

  // Verify knowledge base exists and belongs to the API key's user
  const kbResult = await pool.query(
    'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
    [knowledge_id, req.user!.userId]
  );
  if (kbResult.rows.length === 0) {
    res.status(400).json({ error_code: 2001, error_msg: 'Knowledge base not found' });
    return;
  }

  const topK = retrieval_setting?.top_k ?? 3;
  const scoreThreshold = retrieval_setting?.score_threshold ?? 0.0;

  try {
    const result = await pythonClient.retrieval(knowledge_id, query, topK, scoreThreshold);
    res.json(result);
  } catch (e: any) {
    const status = e.status || 500;
    if (status === 400) {
      res.status(400).json({ error_code: 2001, error_msg: e.message });
    } else {
      res.status(500).json({ error_code: 5001, error_msg: e.message || 'Internal server error' });
    }
  }
});
