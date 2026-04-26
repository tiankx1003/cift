import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authRequired } from '../middleware/auth.js';
import { pool } from '../db.js';
import { success, created, error, ErrorCodes } from '../utils/apiResponse.js';

export const apiKeyRouter = Router();

apiKeyRouter.use(authRequired);

// GET /api/api-keys
apiKeyRouter.get('/', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'SELECT id, name, key, is_active, created_at, last_used_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user!.userId]
  );
  // Mask keys: show only last 4 chars
  const items = rows.map((r: any) => ({
    ...r,
    key: `ck-****${r.key.slice(-4)}`,
  }));
  success(res, items);
});

// POST /api/api-keys
apiKeyRouter.post('/', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return error(res, ErrorCodes.INVALID_PARAM, 'name is required', 400);
  }

  const id = crypto.randomUUID();
  const rawKey = `ck-${crypto.randomBytes(24).toString('hex')}`;

  await pool.query(
    'INSERT INTO api_keys (id, user_id, key, name) VALUES ($1, $2, $3, $4)',
    [id, req.user!.userId, rawKey, name.trim()]
  );

  created(res, {
    id,
    name: name.trim(),
    key: rawKey, // Only returned once on creation
    is_active: true,
    created_at: new Date().toISOString(),
  });
});

// DELETE /api/api-keys/:id
apiKeyRouter.delete('/:id', async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user!.userId]
  );
  if (rows.length === 0) {
    return error(res, ErrorCodes.NOT_FOUND, 'API key not found', 404);
  }
  success(res, { deleted: true });
});
