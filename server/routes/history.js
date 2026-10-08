import { Router } from 'express';
import { toMarkdown, toJSON } from '../../client/src/engine/report.js';

const MODES = new Set(['detection', 'prevention', 'bankers', 'game']);

function rowToRun(row, full = false) {
  const out = {
    id: row.id,
    mode: row.mode,
    title: row.title,
    summary: row.summary,
    deadlocks: row.deadlocks,
    steps: row.steps,
    createdAt: row.created_at,
  };
  if (full) {
    out.input = JSON.parse(row.input_json);
    out.result = JSON.parse(row.result_json);
  }
  return out;
}

export function historyRoutes(db) {
  const r = Router();
  const insert = db.prepare('INSERT INTO simulations (mode, title, input_json, result_json, summary, deadlocks, steps) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const list = db.prepare('SELECT id, mode, title, summary, deadlocks, steps, created_at FROM simulations ORDER BY id DESC LIMIT ?');
  const get = db.prepare('SELECT * FROM simulations WHERE id = ?');
  const del = db.prepare('DELETE FROM simulations WHERE id = ?');
  const clear = db.prepare('DELETE FROM simulations');

  r.get('/', (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json(list.all(limit).map((row) => rowToRun(row)));
  });

  r.post('/', (req, res) => {
    const { mode, title, input, result } = req.body || {};
    if (!MODES.has(mode)) return res.status(400).json({ error: `mode must be one of ${[...MODES].join(', ')}` });
    if (!input || typeof input !== 'object') return res.status(400).json({ error: 'input object is required' });
    if (!result || !Array.isArray(result.steps)) return res.status(400).json({ error: 'result.steps array is required' });
    const summary = typeof result.summary === 'object' ? summarise(mode, result.summary) : '';
    const deadlocks = Number(result.summary?.deadlocks) || 0;
    const info = insert.run(mode, String(title || '').slice(0, 120), JSON.stringify(input), JSON.stringify(result), summary, deadlocks, result.steps.length);
    res.status(201).json(rowToRun(get.get(info.lastInsertRowid)));
  });

  r.delete('/', (_req, res) => {
    clear.run();
    res.json({ ok: true });
  });

  r.get('/:id', (req, res) => {
    const row = get.get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Run not found' });
    res.json(rowToRun(row, true));
  });

  r.get('/:id/export', (req, res) => {
    const row = get.get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Run not found' });
    const run = rowToRun(row, true);
    const format = req.query.format === 'md' ? 'md' : 'json';
    const name = `deadlock-run-${run.id}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    if (format === 'md') {
      res.type('text/markdown').send(toMarkdown(run));
    } else {
      res.type('application/json').send(toJSON(run));
    }
  });

  r.delete('/:id', (req, res) => {
    const info = del.run(Number(req.params.id));
    if (info.changes === 0) return res.status(404).json({ error: 'Run not found' });
    res.json({ ok: true });
  });

  return r;
}

function summarise(mode, s) {
  if (mode === 'bankers') {
    let t = s.safe ? `Safe, sequence ⟨${(s.sequence || []).map((p) => 'P' + p).join(', ')}⟩` : 'Unsafe state';
    if (s.request) t += `; request by P${s.request.pid} ${s.request.granted ? 'granted' : 'denied'}`;
    return t;
  }
  if (mode === 'game') return `${s.status === 'won' ? 'Won' : 'Deadlocked'} — score ${s.score}, ${s.moves} moves`;
  return `${s.deadlocks} deadlock(s), ${s.rollbacks} rollback(s), committed ${(s.committed || []).join(', ') || 'none'}${s.stuck?.length ? `, stuck ${s.stuck.join(', ')}` : ''}`;
}
