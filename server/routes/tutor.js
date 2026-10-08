import { Router } from 'express';

/** Logs tutor Q&A so the analytics dashboard can show the most-asked questions. */
export function tutorRoutes(db) {
  const r = Router();
  const insert = db.prepare('INSERT INTO tutor_logs (simulation_id, mode, question, intent, answer) VALUES (?, ?, ?, ?, ?)');
  const list = db.prepare('SELECT id, simulation_id, mode, question, intent, created_at FROM tutor_logs ORDER BY id DESC LIMIT ?');

  r.get('/', (req, res) => {
    res.json(list.all(Math.min(200, Number(req.query.limit) || 50)));
  });

  r.post('/', (req, res) => {
    const { simulationId, mode, question, intent, answer } = req.body || {};
    if (typeof question !== 'string' || !question.trim()) return res.status(400).json({ error: 'question is required' });
    if (typeof answer !== 'string') return res.status(400).json({ error: 'answer is required' });
    const info = insert.run(Number.isInteger(simulationId) ? simulationId : null, String(mode || '').slice(0, 20), question.slice(0, 500), String(intent || '').slice(0, 40), answer.slice(0, 4000));
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  return r;
}
