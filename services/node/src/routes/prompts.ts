import { Router, Request, Response, NextFunction } from 'express';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';
import { pool } from '../db.js';

export const promptRouter = Router({ mergeParams: true });

promptRouter.use(authRequired);

promptRouter.use(async (req: Request, res: Response, next: NextFunction) => {
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

// GET /api/kbs/:kbId/prompt-templates
promptRouter.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pythonClient.listPromptTemplates(req.params.kbId as string);
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// POST /api/kbs/:kbId/prompt-templates
promptRouter.post('/', async (req: Request, res: Response) => {
  try {
    const result = await pythonClient.createPromptTemplate(req.params.kbId as string, req.body);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// PUT /api/kbs/:kbId/prompt-templates/:templateId
promptRouter.put('/:templateId', async (req: Request, res: Response) => {
  try {
    const result = await pythonClient.updatePromptTemplate(
      req.params.kbId as string,
      req.params.templateId as string,
      req.body,
    );
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// DELETE /api/kbs/:kbId/prompt-templates/:templateId
promptRouter.delete('/:templateId', async (req: Request, res: Response) => {
  try {
    await pythonClient.deletePromptTemplate(
      req.params.kbId as string,
      req.params.templateId as string,
    );
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// PUT /api/kbs/:kbId/prompt-templates/:templateId/default
promptRouter.put('/:templateId/default', async (req: Request, res: Response) => {
  try {
    const result = await pythonClient.setDefaultPromptTemplate(
      req.params.kbId as string,
      req.params.templateId as string,
    );
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});
