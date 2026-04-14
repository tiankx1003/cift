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

// POST /api/kbs/:kbId/search
searchRouter.post('/', async (req: Request, res: Response) => {
  const { query, top_k } = req.body;
  if (!query) {
    res.status(400).json({ code: 400, message: 'query is required' });
    return;
  }
  const result = await pythonClient.search(req.params.kbId as string, query, top_k);
  res.json(result);
});
