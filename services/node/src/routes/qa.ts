import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';

export const qaRouter = Router();

qaRouter.use(authRequired);

// POST /api/qa/sessions
qaRouter.post('/sessions', async (req: Request, res: Response) => {
  const { title } = req.body;
  try {
    const result = await pythonClient.createQaSession(req.user!.userId, title);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// GET /api/qa/sessions
qaRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    const result = await pythonClient.listQaSessions(req.user!.userId);
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// PATCH /api/qa/sessions/:sessionId
qaRouter.patch('/sessions/:sessionId', async (req: Request, res: Response) => {
  const { title } = req.body;
  if (!title) {
    res.status(400).json({ code: 400, message: 'title is required' });
    return;
  }
  try {
    const result = await pythonClient.renameQaSession(req.params.sessionId as string, title);
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// GET /api/qa/sessions/:sessionId/messages
qaRouter.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const result = await pythonClient.getQaMessages(req.params.sessionId as string);
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// DELETE /api/qa/sessions/:sessionId
qaRouter.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    await pythonClient.deleteQaSession(req.params.sessionId as string);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// POST /api/qa/sessions/:sessionId/stream — SSE proxy
qaRouter.post('/sessions/:sessionId/stream', async (req: Request, res: Response) => {
  const { query, kb_ids, top_k, similarity_threshold, template_id } = req.body;

  if (!query) {
    res.status(400).json({ code: 400, message: 'query is required' });
    return;
  }

  try {
    const upstream = await pythonClient.streamQaMessage(
      req.params.sessionId as string,
      { query, kb_ids, top_k, similarity_threshold, template_id },
      req.user!.userId,
    );

    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({}));
      res.status(upstream.status).json({ code: 1, message: body.detail || 'QA failed' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (upstream.body) {
      const reader = upstream.body.getReader();
      const pump = async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } catch {
          // Client disconnected
        }
        res.end();
      };
      await pump();
    } else {
      const buf = await upstream.arrayBuffer();
      res.write(Buffer.from(buf));
      res.end();
    }
  } catch (e: any) {
    if (!res.headersSent) {
      res.status(500).json({ code: 1, message: e.message });
    }
  }
});
