import { Router, Request, Response, NextFunction } from 'express';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';
import { pool } from '../db.js';

export const chunkConfigRouter = Router({ mergeParams: true });

chunkConfigRouter.use(authRequired);

// Verify KB ownership
chunkConfigRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  const kbId = req.params.kbId as string;
  const result = await pool.query(
    'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
    [kbId, req.user!.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ code: 404, message: 'Knowledge base not found' });
    return;
  }
  next();
});

// GET /api/kbs/:kbId/chunk-configs
chunkConfigRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await pythonClient.listChunkConfigs(req.params.kbId as string);
    res.json(configs);
  } catch (e) { next(e); }
});

// POST /api/kbs/:kbId/chunk-configs
chunkConfigRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await pythonClient.createChunkConfig(req.params.kbId as string, req.body);
    res.status(201).json(config);
  } catch (e) { next(e); }
});

// PUT /api/kbs/:kbId/chunk-configs/:configId
chunkConfigRouter.put('/:configId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await pythonClient.updateChunkConfig(req.params.kbId as string, req.params.configId as string, req.body);
    res.json(config);
  } catch (e) { next(e); }
});

// DELETE /api/kbs/:kbId/chunk-configs/:configId
chunkConfigRouter.delete('/:configId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pythonClient.deleteChunkConfig(req.params.kbId as string, req.params.configId as string);
    res.json({ status: 'ok' });
  } catch (e) { next(e); }
});

// PUT /api/kbs/:kbId/chunk-configs/:configId/default
chunkConfigRouter.put('/:configId/default', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await pythonClient.setDefaultChunkConfig(req.params.kbId as string, req.params.configId as string);
    res.json(config);
  } catch (e) { next(e); }
});
