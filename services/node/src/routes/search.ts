import { Router, Request, Response, NextFunction } from 'express';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';
import { pool } from '../db.js';

export const searchRouter = Router({ mergeParams: true });

searchRouter.use(authRequired);

searchRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  const result = await pool.query(
    'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
    [req.params.kbId, req.user!.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ code: 404, message: 'Knowledge base not found' });
    return;
  }
  next();
});

/**
 * @openapi
 * /kbs/{kbId}/search:
 *   post:
 *     tags: [Search]
 *     summary: 语义搜索
 *     parameters:
 *       - { name: kbId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string, example: "如何配置模型" }
 *               top_k: { type: integer, default: 10, description: "返回结果数量" }
 *               similarity_threshold: { type: number, default: 0, description: "最低相似度阈值 (0-1)" }
 *               vector_weight: { type: number, default: 0.7 }
 *               hybrid_threshold: { type: number, default: 0 }
 *     responses:
 *       200:
 *         description: 搜索结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       chunk_id: { type: string }
 *                       content: { type: string }
 *                       score: { type: number }
 *                       metadata: { type: object }
 */
// POST /api/kbs/:kbId/search
searchRouter.post('/', async (req: Request, res: Response) => {
  const { query, top_k, similarity_threshold, vector_weight, hybrid_threshold, use_rerank, search_mode } = req.body;
  if (!query) {
    res.status(400).json({ code: 400, message: 'query is required' });
    return;
  }
  const result = await pythonClient.search(
    req.params.kbId as string,
    query,
    top_k,
    similarity_threshold,
    vector_weight,
    hybrid_threshold,
    use_rerank,
    search_mode,
  );
  res.json(result);
});
