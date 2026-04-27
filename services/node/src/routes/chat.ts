import { Router, Request, Response, NextFunction } from 'express';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';
import { pool } from '../db.js';

export const chatRouter = Router();

// All chat routes require JWT auth
chatRouter.use(authRequired);

// Helper: verify KB ownership
async function verifyKbOwnership(kbId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM knowledge_bases WHERE id = $1 AND user_id = $2',
    [kbId, userId]
  );
  return result.rows.length > 0;
}

// POST /api/chat/sessions
chatRouter.post('/sessions', async (req: Request, res: Response) => {
  const { kb_id, title } = req.body;
  if (!kb_id) {
    res.status(400).json({ code: 400, message: 'kb_id is required' });
    return;
  }
  const owned = await verifyKbOwnership(kb_id, req.user!.userId);
  if (!owned) {
    res.status(404).json({ code: 404, message: 'Knowledge base not found' });
    return;
  }
  try {
    const result = await pythonClient.createChatSession(kb_id, title);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// GET /api/chat/sessions?kb_id=xxx
chatRouter.get('/sessions', async (req: Request, res: Response) => {
  const kbId = req.query.kb_id as string;
  if (!kbId) {
    res.status(400).json({ code: 400, message: 'kb_id is required' });
    return;
  }
  const owned = await verifyKbOwnership(kbId, req.user!.userId);
  if (!owned) {
    res.status(404).json({ code: 404, message: 'Knowledge base not found' });
    return;
  }
  try {
    const result = await pythonClient.listChatSessions(kbId);
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// GET /api/chat/sessions/:sessionId/messages
chatRouter.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  try {
    const result = await pythonClient.getChatMessages(sessionId);
    res.json(result);
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// DELETE /api/chat/sessions/:sessionId
chatRouter.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  try {
    await pythonClient.deleteChatSession(sessionId);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(e.status || 500).json({ code: e.status || 500, message: e.message });
  }
});

// POST /api/chat/sessions/:sessionId/stream — SSE proxy
chatRouter.post('/sessions/:sessionId/stream', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const { query, top_k, similarity_threshold, template_id } = req.body;

  if (!query) {
    res.status(400).json({ code: 400, message: 'query is required' });
    return;
  }

  try {
    const upstream = await pythonClient.streamChatMessage(sessionId, {
      query,
      top_k,
      similarity_threshold,
      template_id,
    });

    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({}));
      res.status(upstream.status).json({ code: 1, message: body.detail || 'Chat failed' });
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
        } catch (err) {
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
