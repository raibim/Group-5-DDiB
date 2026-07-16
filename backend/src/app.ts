import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import licenseRequestRoutes from './routes/licenseRequests';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/** Builds the Express app without starting a listener or connecting to Mongo/chain - lets
 * tests import this directly with supertest against mocked models/services. */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  // licenseRequestRoutes declares its own full paths (including /projects/:id/license-requests
  // and /license-requests/...) so it is mounted at /api directly.
  app.use('/api', licenseRequestRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
