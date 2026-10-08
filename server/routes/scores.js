import { Router } from 'express';

export function scoreRoutes(db) {
  const r = Router();
  const insert = db.prepare('INSERT INTO game_scores (level, level_name, score, moves, hints_used, deadlocked) VALUES (?, ?, ?, ?, ?, ?)');
  const list = db.prepare('SELECT * FROM game_scores ORDER BY id DESC LIMIT ?');
  const best = db.prepare('SELECT level, level_name, MAX(score) AS best, COUNT(*) AS attempts, SUM(deadlocked) AS deadlocks FROM game_scores GROUP BY level ORDER BY level');

  r.get('/', (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json({ recent: list.all(limit), best: best.all() });
  });

  r.post('/', (req, res) => {
    const { level, levelName, score, moves, hintsUsed, deadlocked } = req.body || {};
    if (typeof level !== 'string' || !level) return res.status(400).json({ error: 'level is required' });
    if (!Number.isInteger(score) || score < 0 || score > 1000) return res.status(400).json({ error: 'score must be an integer 0-1000' });
    if (!Number.isInteger(moves) || moves < 0) return res.status(400).json({ error: 'moves must be a non-negative integer' });
    const info = insert.run(level.slice(0, 40), String(levelName || '').slice(0, 80), score, moves, Number(hintsUsed) || 0, deadlocked ? 1 : 0);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  return r;
}
