import express from 'express';
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

async function main() {
  initFirebaseAdmin();
  await connectMongo();

  const app = express();
  app.disable('x-powered-by');
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

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/me', requireAuth, meRoutes);
  app.use('/api/workouts', requireAuth, workoutsRoutes);
  app.use('/api/running-sessions', requireAuth, runningRoutes);
  app.use('/api/migrate', requireAuth, migrateRoutes);

  if (isProduction) {
    // În funcție de versiunea exactă de Angular, build-ul ajunge fie în dist/FitTrack-Angular/browser, fie în dist/fit-track-angular/browser
    const frontendPath = path.join(__dirname, '../../dist/FitTrack-Angular/browser');
    app.use(express.static(frontendPath));
    app.get('*', (_req, res, next) => {
      if (_req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
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
