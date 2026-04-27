import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { pool } from '../db.js';

export const apiKeyRouter = Router();

apiKeyRouter.use(authRequired);

/**
 * @openapi
 * /api-keys:
 *   get:
 *     tags: [API Keys]
 *     summary: 获取 API Key 列表
 *     responses:
 *       200:
 *         description: API Key 列表（key 脱敏）
 */
// GET /api/api-keys
apiKeyRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, key, is_active, created_at, last_used_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user!.userId]
    );
    // Mask keys: show only last 4 chars
    const items = rows.map((r: any) => ({
      ...r,
      key: `ck-****${r.key.slice(-4)}`,
    }));
    res.json(items);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api-keys:
 *   post:
 *     tags: [API Keys]
 *     summary: 创建 API Key
 *     description: 返回完整 key，仅此一次展示
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Dify 外部知识库" }
 *     responses:
 *       201: { description: 创建成功，返回完整 key }
 */
// POST /api/api-keys
apiKeyRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ code: 400, message: 'name is required' });
      return;
    }

    const id = crypto.randomUUID();
    const rawKey = `ck-${crypto.randomBytes(24).toString('hex')}`;

    await pool.query(
      'INSERT INTO api_keys (id, user_id, key, name) VALUES ($1, $2, $3, $4)',
      [id, req.user!.userId, rawKey, name.trim()]
    );

    res.status(201).json({
      id,
      name: name.trim(),
      key: rawKey,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api-keys/{id}:
 *   delete:
 *     tags: [API Keys]
 *     summary: 删除 API Key
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 删除成功 }
 *       404: { description: API Key 不存在 }
 */
// DELETE /api/api-keys/:id
apiKeyRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.userId]
    );
    if (rows.length === 0) {
      res.status(404).json({ code: 404, message: 'API key not found' });
      return;
    }
    res.json({ status: 'ok' });
  } catch (e) { next(e); }
});
