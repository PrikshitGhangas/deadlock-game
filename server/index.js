/**
 * index.js — start the Deadlock Game API server.
 * Run with: npm run dev -w server   (or `npm run dev` at the root to start client + server)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.API_PORT) || 3001;
const here = path.dirname(fileURLToPath(import.meta.url));

const db = openDatabase();
const app = createApp(db);

// In production, serve the built client from the same process.
const dist = path.join(here, '..', 'client', 'dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => (err ? next() : undefined));
});

app.listen(PORT, () => {
  console.log(`Deadlock Game API listening on http://localhost:${PORT}`);
});
