import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { HealthResponse } from '@speaking-practice/types';
import { sessionRoutes } from './routes/session.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

const app = Fastify({ logger: true });

const start = async () => {
  app.register(cors, { origin: true });
  app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  });

  app.get('/health', async (): Promise<HealthResponse> => {
    return { status: 'ok' };
  });

  app.register(sessionRoutes);

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
