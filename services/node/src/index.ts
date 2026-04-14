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

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/kbs', kbRouter);
app.use('/api/kbs/:kbId/documents', docRouter);
app.use('/api/kbs/:kbId/search', searchRouter);

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
