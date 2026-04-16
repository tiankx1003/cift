import express from 'express';
import cors from 'cors';
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
