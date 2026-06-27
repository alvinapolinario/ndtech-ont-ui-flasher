import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { config } from '@ndtech/core';
import { SAFETY_NOTICE } from '@ndtech/shared';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ndtech-ont-api', safety: SAFETY_NOTICE });
});

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.apiPort, config.apiHost, () => {
  console.log(`[ndtech-api] listening on http://${config.apiHost}:${config.apiPort}`);
  console.log(`[ndtech-api] ${SAFETY_NOTICE}`);
});

// Graceful shutdown so dev reloads release the port cleanly.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
