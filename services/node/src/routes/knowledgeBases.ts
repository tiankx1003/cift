import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';

export const kbRouter = Router();

kbRouter.use(authRequired);

// GET /api/kbs
kbRouter.get('/', async (req: Request, res: Response) => {
  const result = await pool.query(
    'SELECT id as kb_id, name, description, doc_count, created_at FROM knowledge_bases WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user!.userId]
  );
  res.json(result.rows);
});

// POST /api/kbs
kbRouter.post('/', async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ code: 400, message: 'name is required' });
    return;
  }

  const kb = await pythonClient.createKb(name, description || '');
  await pool.query('UPDATE knowledge_bases SET user_id = $1 WHERE id = $2', [req.user!.userId, kb.kb_id]);

  res.status(201).json({ kb_id: kb.kb_id, name: kb.name, description: kb.description, doc_count: kb.doc_count });
});

// GET /api/kbs/:kbId
kbRouter.get('/:kbId', async (req: Request, res: Response) => {
  const result = await pool.query(
    'SELECT id as kb_id, name, description, doc_count, created_at FROM knowledge_bases WHERE id = $1 AND user_id = $2',
    [req.params.kbId, req.user!.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ code: 404, message: 'Knowledge base not found' });
    return;
  }
  res.json(result.rows[0]);
});

// PUT /api/kbs/:kbId
kbRouter.put('/:kbId', async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name && description === undefined) {
    res.status(400).json({ code: 400, message: 'At least one of name or description is required' });
    return;
  }

  const existing = await pool.query(
    'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
    [req.params.kbId, req.user!.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ code: 404, message: 'Knowledge base not found' });
    return;
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (name) { sets.push(`name = $${idx++}`); values.push(name); }
  if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description); }
  sets.push(`updated_at = NOW()`);
  values.push(req.params.kbId);

  await pool.query(`UPDATE knowledge_bases SET ${sets.join(', ')} WHERE id = $${idx}`, values);

  const result = await pool.query(
    'SELECT id as kb_id, name, description, doc_count FROM knowledge_bases WHERE id = $1',
    [req.params.kbId]
  );
  res.json(result.rows[0]);
});

// DELETE /api/kbs/:kbId
kbRouter.delete('/:kbId', async (req: Request, res: Response) => {
  const existing = await pool.query(
    'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
    [req.params.kbId, req.user!.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ code: 404, message: 'Knowledge base not found' });
    return;
  }

  await pythonClient.deleteKb(req.params.kbId as string);
  res.json({ status: 'ok' });
});
