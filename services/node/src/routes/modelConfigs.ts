import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';

export const modelConfigRouter = Router();

modelConfigRouter.use(authRequired);

// GET /api/models
modelConfigRouter.get('/', async (req: Request, res: Response) => {
  const type = req.query.type as string | undefined;
  const configs = await pythonClient.listModels(type);
  res.json(configs);
});

// GET /api/models/active
modelConfigRouter.get('/active', async (_req: Request, res: Response) => {
  const configs = await pythonClient.getActiveModels();
  res.json(configs);
});

// POST /api/models
modelConfigRouter.post('/', async (req: Request, res: Response) => {
  const config = await pythonClient.createModel(req.body);
  res.status(201).json(config);
});

// PUT /api/models/:id
modelConfigRouter.put('/:id', async (req: Request, res: Response) => {
  const config = await pythonClient.updateModel(req.params.id as string, req.body);
  res.json(config);
});

// DELETE /api/models/:id
modelConfigRouter.delete('/:id', async (req: Request, res: Response) => {
  await pythonClient.deleteModel(req.params.id as string);
  res.json({ status: 'ok' });
});

// PUT /api/models/:id/activate
modelConfigRouter.put('/:id/activate', async (req: Request, res: Response) => {
  const config = await pythonClient.activateModel(req.params.id as string);
  res.json(config);
});

// POST /api/models/test
modelConfigRouter.post('/test', async (req: Request, res: Response) => {
  const result = await pythonClient.testModel(req.body);
  res.json(result);
});
