/**
 * app.js — Express application factory (kept separate from index.js so tests
 * can spin up the app against an in-memory database).
 */
import express from 'express';
import cors from 'cors';
import { historyRoutes } from './routes/history.js';
import { scoreRoutes } from './routes/scores.js';
import { tutorRoutes } from './routes/tutor.js';
import { analyticsRoutes } from './routes/analytics.js';
import { aiRoutes } from './routes/ai.js';
import { aiStatus } from './ai.js';
import { SAMPLES } from '../client/src/engine/samples.js';

const MAX_BODY = '2mb';

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: MAX_BODY }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString(), ai: aiStatus() }));
  app.get('/api/samples', (_req, res) => res.json(SAMPLES));

  app.use('/api/history', historyRoutes(db));
  app.use('/api/scores', scoreRoutes(db));
  app.use('/api/tutor-log', tutorRoutes(db));
  app.use('/api/analytics', analyticsRoutes(db));
  app.use('/api/ai', aiRoutes(db));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large (max 2 MB).' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body is not valid JSON.' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
