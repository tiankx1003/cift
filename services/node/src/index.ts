import express, { RequestHandler, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { migrate } from './db.js';
import { ensureBucket } from './services/minioClient.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { kbRouter } from './routes/knowledgeBases.js';
import { docRouter } from './routes/documents.js';
import { searchRouter } from './routes/search.js';
import { chunkConfigRouter } from './routes/chunkConfigs.js';
import { modelConfigRouter } from './routes/modelConfigs.js';
import { knowledgeGraphRouter } from './routes/knowledgeGraphs.js';
import { apiKeyRouter } from './routes/apiKeys.js';
import { retrievalRouter } from './routes/retrieval.js';
import { exportRouter } from './routes/export.js';
import { chatRouter } from './routes/chat.js';
import { promptRouter } from './routes/prompts.js';
import { swaggerSpec } from './swagger.js';

// Wrap async route handlers to catch unhandled rejections
function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Patch express Router to auto-wrap async handlers
const originalRouter = express.Router;
express.Router = function (options?) {
  const router = originalRouter(options);
  const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
  for (const method of methods) {
    const original = router[method].bind(router);
    (router as any)[method] = (path: any, ...handlers: any[]) => {
      const wrapped = handlers.map((h: any) =>
        typeof h === 'function' && h.length <= 3 ? asyncHandler(h) : h
      );
      return original(path, ...wrapped);
    };
  }
  return router;
};

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/kbs', kbRouter);
app.use('/api/kbs/:kbId/documents', docRouter);
app.use('/api/kbs/:kbId/search', searchRouter);
app.use('/api/kbs/:kbId/chunk-configs', chunkConfigRouter);
app.use('/api/models', modelConfigRouter);
app.use('/api/kbs/:kbId/knowledge-graphs', knowledgeGraphRouter);
app.use('/api/api-keys', apiKeyRouter);

// Swagger API docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Dify-compatible retrieval endpoint (uses API Key auth)
app.use('/api/retrieval', retrievalRouter);

// Chat (SSE streaming)
app.use('/api/chat', chatRouter);

// Export (must be after /api/kbs/:kbId/documents to avoid route conflicts)
app.use('/api/kbs/:kbId/export', exportRouter);

// Prompt templates
app.use('/api/kbs/:kbId/prompt-templates', promptRouter);

app.use(errorHandler);

async function start() {
  await migrate();
  try {
    await ensureBucket();
  } catch (e) {
    console.warn('MinIO not available at startup:', (e as Error).message);
  }
  app.listen(config.port, () => {
    console.log(`CIFT Node Gateway running on port ${config.port}`);
  });
}

start();
