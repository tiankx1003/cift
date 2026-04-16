import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';
import { pool } from '../db.js';

export const knowledgeGraphRouter = Router({ mergeParams: true });

knowledgeGraphRouter.use(authRequired);

// Verify KB ownership
knowledgeGraphRouter.use(async (req: Request, res: Response, next) => {
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

// POST /api/kbs/:kbId/knowledge-graphs
knowledgeGraphRouter.post('/', async (req: Request, res: Response) => {
  const result = await pythonClient.createKnowledgeGraph(req.params.kbId as string);
  res.status(201).json(result);
});

// GET /api/kbs/:kbId/knowledge-graphs
knowledgeGraphRouter.get('/', async (req: Request, res: Response) => {
  const graphs = await pythonClient.listKnowledgeGraphs(req.params.kbId as string);
  res.json(graphs);
});

// GET /api/kbs/:kbId/knowledge-graphs/:id
knowledgeGraphRouter.get('/:id', async (req: Request, res: Response) => {
  const graph = await pythonClient.getKnowledgeGraph(req.params.kbId as string, req.params.id as string);
  res.json(graph);
});

// DELETE /api/kbs/:kbId/knowledge-graphs/:id
knowledgeGraphRouter.delete('/:id', async (req: Request, res: Response) => {
  await pythonClient.deleteKnowledgeGraph(req.params.kbId as string, req.params.id as string);
  res.json({ status: 'ok' });
});
