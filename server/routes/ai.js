import { Router } from 'express';
import { aiConfig, aiStatus, askLLM, SYSTEM_PROMPT } from '../ai.js';

const MAX_Q = 1000;
const MAX_CTX = 12000;
const MAX_HISTORY = 8;

/**
 * POST /api/ai/ask  { question, context, offlineAnswer?, history? }
 *   context  = plain-text summary of the current run (built client-side)
 *   history  = previous turns [{role:'user'|'assistant', content}]
 * Responds { answer, provider, model } or 503 when no key is configured.
 */
export function aiRoutes(db) {
  const r = Router();
  const log = db.prepare('INSERT INTO tutor_logs (simulation_id, mode, question, intent, answer) VALUES (?, ?, ?, ?, ?)');

  r.get('/status', (_req, res) => res.json(aiStatus()));

  r.post('/ask', async (req, res) => {
    const cfg = aiConfig();
    if (!cfg.enabled) return res.status(503).json({ enabled: false, error: cfg.error || 'AI tutor is not configured. Add AI_PROVIDER and AI_API_KEY to server/.env.' });

    const { question, context, offlineAnswer, history, mode, simulationId } = req.body || {};
    if (typeof question !== 'string' || !question.trim()) return res.status(400).json({ error: 'question is required' });
    if (question.length > MAX_Q) return res.status(400).json({ error: `question is too long (max ${MAX_Q} characters)` });

    const ctx = String(context || '').slice(0, MAX_CTX);
    const prior = Array.isArray(history)
      ? history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
      : [];

    const userTurn = [
      '=== SIMULATION DATA ===',
      ctx || '(no simulation has been run yet)',
      offlineAnswer ? `\n=== RULE-ENGINE ANSWER TO THE SAME QUESTION (trust its facts) ===\n${String(offlineAnswer).slice(0, 2000)}` : '',
      `\n=== STUDENT QUESTION ===\n${question.trim()}`,
    ].join('\n');

    try {
      const answer = await askLLM(cfg, { system: SYSTEM_PROMPT, history: [...prior, { role: 'user', content: userTurn }] });
      log.run(Number.isInteger(simulationId) ? simulationId : null, String(mode || '').slice(0, 20), question.slice(0, 500), 'llm', answer.slice(0, 4000));
      res.json({ answer, provider: cfg.provider, model: cfg.model });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  return r;
}
