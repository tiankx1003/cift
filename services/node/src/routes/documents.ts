import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authRequired } from '../middleware/auth.js';
import { pythonClient } from '../services/pythonClient.js';
import { pool } from '../db.js';

export const docRouter = Router({ mergeParams: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ALLOWED = new Set(['.txt', '.md']);
const MIME_MAP: Record<string, string> = { '.txt': 'text/plain', '.md': 'text/markdown' };

docRouter.use(authRequired);

docRouter.use(async (req: Request, res: Response, next: NextFunction) => {
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

// GET /api/kbs/:kbId/documents
docRouter.get('/', async (req: Request, res: Response) => {
  const docs = await pythonClient.listDocuments(req.params.kbId as string);
  res.json(docs);
});

// POST /api/kbs/:kbId/documents/upload
docRouter.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ code: 400, message: 'No file uploaded' });
    return;
  }

  const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  if (!ALLOWED.has(ext)) {
    res.status(400).json({ code: 400, message: `Unsupported file type '${ext}'. Allowed: .txt, .md` });
    return;
  }

  const kbId = req.params.kbId as string;
  const result = await pythonClient.uploadDocument(kbId, file.buffer, file.originalname, MIME_MAP[ext]);
  res.status(201).json(result);
});

// DELETE /api/kbs/:kbId/documents/:docId
docRouter.delete('/:docId', async (req: Request, res: Response) => {
  const kbId = req.params.kbId as string;
  const docId = req.params.docId as string;
  await pythonClient.deleteDocVectors(kbId, docId);
  res.json({ status: 'ok' });
});

// POST /api/kbs/:kbId/documents/:docId/retry
docRouter.post('/:docId/retry', async (req: Request, res: Response) => {
  const kbId = req.params.kbId as string;
  const docId = req.params.docId as string;

  const docs = await pythonClient.listDocuments(kbId);
  const doc = docs.find((d) => d.doc_id === docId);
  if (!doc) {
    res.status(404).json({ code: 404, message: 'Document not found' });
    return;
  }

  const storageKey = `${kbId}/${doc.doc_id}/${doc.filename}`;
  const result = await pythonClient.parseDocument(doc.doc_id, storageKey, doc.file_type, kbId);

  res.json({
    doc_id: doc.doc_id,
    status: result.status,
    chunk_count: result.chunk_count,
    error_message: result.error_message,
  });
});
