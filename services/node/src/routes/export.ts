import { Router, Request, Response } from 'express';
import { pythonClient } from '../services/pythonClient.js';

export const exportRouter = Router();

// GET /api/kbs/:kbId/export — Export KB chunks as JSON or CSV
exportRouter.get('/', async (req: Request, res: Response) => {
  const kbId = req.params.kbId as string;
  const format = (req.query.format as string) || 'json';

  try {
    const upstream = await pythonClient.exportKb(kbId, format);
    if (!upstream.ok) {
      const body = await upstream.json().catch(() => ({}));
      res.status(upstream.status).json({ code: 1, message: body.detail || 'Export failed' });
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const disposition = upstream.headers.get('content-disposition') || '';

    res.setHeader('Content-Type', contentType);
    if (disposition) {
      res.setHeader('Content-Disposition', disposition);
    }

    if (upstream.body) {
      const reader = upstream.body.getReader();
      const pump = async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      await pump();
    } else {
      const buf = await upstream.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch (e: any) {
    res.status(500).json({ code: 1, message: e.message || 'Export failed' });
  }
});
