import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './config/env';
import { initFirebaseAdmin } from './config/firebase-admin';
import { connectMongo } from './db/mongo';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFound } from './middleware/error';
import meRoutes from './routes/me.routes';
import workoutsRoutes from './routes/workouts.routes';
import runningRoutes from './routes/running-sessions.routes';
import migrateRoutes from './routes/migrate.routes';
import communityRoutes from './routes/community.routes';
import { apiLimiter } from './middleware/rate-limit';

async function main() {
  initFirebaseAdmin();
  await connectMongo();

  const app = express();
  app.disable('x-powered-by');
  if (isProduction) {
    // in productie stam dupa un reverse proxy; fara asta express-rate-limit
    // nu poate identifica IP-ul real din X-Forwarded-For
    app.set('trust proxy', 1);
  }
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  if (!isProduction) {
    app.use(morgan('dev'));
  }

  app.use('/api/', apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/me', requireAuth, meRoutes);
  app.use('/api/workouts', requireAuth, workoutsRoutes);
  app.use('/api/running-sessions', requireAuth, runningRoutes);
  app.use('/api/migrate', requireAuth, migrateRoutes);
  app.use('/api/community', requireAuth, communityRoutes);

  if (isProduction) {
    // Serveste frontend-ul doar daca build-ul exista langa server (deploy all-in-one).
    // Pe un host doar-API (Render/Railway, cu frontend-ul pe Firebase Hosting) folderul
    // lipseste si sarim peste, ca sa nu crape sendFile pe fisier inexistent.
    const frontendPath = path.join(__dirname, '../../dist/FitTrack-Angular/browser');
    if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
      app.use(express.static(frontendPath));
      app.get('*', (_req, res, next) => {
        if (_req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    }
  }

  app.use(notFound);
  app.use(errorHandler);

  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
