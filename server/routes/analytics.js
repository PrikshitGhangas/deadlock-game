import { Router } from 'express';

export function analyticsRoutes(db) {
  const r = Router();
  const byMode = db.prepare('SELECT mode, COUNT(*) AS runs, SUM(CASE WHEN deadlocks > 0 THEN 1 ELSE 0 END) AS withDeadlock, AVG(steps) AS avgSteps FROM simulations GROUP BY mode');
  const totals = db.prepare('SELECT COUNT(*) AS runs, COALESCE(SUM(deadlocks),0) AS deadlocks, COALESCE(AVG(steps),0) AS avgSteps FROM simulations');
  const scoreTrend = db.prepare('SELECT id, level, score, deadlocked, created_at FROM game_scores ORDER BY id DESC LIMIT 30');
  const levelStats = db.prepare('SELECT level, level_name AS levelName, COUNT(*) AS attempts, SUM(deadlocked) AS deadlocks, MAX(score) AS best, AVG(score) AS avg FROM game_scores GROUP BY level ORDER BY level');
  const topIntents = db.prepare('SELECT intent, COUNT(*) AS n FROM tutor_logs GROUP BY intent ORDER BY n DESC LIMIT 8');
  const recentQ = db.prepare('SELECT question FROM tutor_logs ORDER BY id DESC LIMIT 10');
  const perDay = db.prepare("SELECT substr(created_at,1,10) AS day, COUNT(*) AS runs FROM simulations GROUP BY day ORDER BY day DESC LIMIT 14");

  r.get('/', (_req, res) => {
    res.json({
      totals: totals.get(),
      byMode: byMode.all(),
      scoreTrend: scoreTrend.all().reverse(),
      levelStats: levelStats.all(),
      tutor: { intents: topIntents.all(), recent: recentQ.all().map((x) => x.question) },
      perDay: perDay.all().reverse(),
    });
  });

  return r;
}
