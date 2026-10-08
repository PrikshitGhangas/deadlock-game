import { useEffect, useMemo, useState } from 'react';
import { LEVELS, randomLevel, createGame, availableMoves, applyMove, computeHints, undoMove } from '../engine/game.js';
import { api } from '../api/client.js';
import { readUrlParams } from '../hooks/useUrlState.js';
import WaitForGraph from '../components/viz/WaitForGraph.jsx';
import LockTable from '../components/viz/LockTable.jsx';
import StepExplanation from '../components/explain/StepExplanation.jsx';
import Tutor from '../components/explain/Tutor.jsx';
import ResultActions from '../components/layout/ResultActions.jsx';
import { Icon } from '../components/common/Icons.jsx';

export default function GamePage({ theme, toast, active = true }) {
  const initialLevel = (() => { const q = readUrlParams(); return LEVELS.find((l) => l.id === q.level) || LEVELS[0]; })();
  const [level, setLevel] = useState(initialLevel);
  const [game, setGame] = useState(() => createGame(initialLevel));
  const [hints, setHints] = useState(null);
  const [best, setBest] = useState({});
  const [posted, setPosted] = useState(false);

  useEffect(() => { api.scores.list().then((r) => setBest(Object.fromEntries(r.best.map((b) => [b.level, b.best])))).catch(() => {}); }, [posted]);

  const start = (lvl) => { setLevel(lvl); setGame(createGame(lvl)); setHints(null); setPosted(false); };
  const moves = availableMoves(game);
  const lastStep = game.steps[game.steps.length - 1];

  const play = (txn) => {
    const { state } = applyMove(game, txn);
    setGame(state);
    setHints(null);
  };

  const hint = () => {
    const { state, hints: h } = computeHints(game);
    setGame(state);
    setHints(Object.fromEntries(h.map((x) => [x.txn, x])));
  };

  // post score when the level ends
  useEffect(() => {
    if (game.status === 'playing' || posted) return;
    setPosted(true);
    api.scores.save({ level: level.id, levelName: level.name, score: game.score, moves: game.moves.length, hintsUsed: game.hintsUsed, deadlocked: game.status === 'deadlock' })
      .then(() => toast(game.status === 'won' ? `Level complete! Score ${game.score} saved.` : 'Deadlock recorded. Try again!'))
      .catch(() => {});
  }, [game.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const resources = useMemo(() => [...new Set(game.txns.flatMap((t) => [...game.pending[t], ...game.done[t]].filter((o) => o.res).map((o) => o.res)))], [game]);
  const tutorCtx = useMemo(() => ({ mode: 'game', result: { steps: game.steps, summary: { status: game.status, score: game.score, moves: game.moves.length } }, currentStep: game.steps.length - 1, resources, levelTip: level.tip }), [game, resources, level]);
  const run = game.status !== 'playing' ? { mode: 'game', title: `Game · ${level.name}`, input: { schedule: level.schedule, level: level.id }, result: { steps: game.steps, summary: { status: game.status, score: game.score, moves: game.moves.length, hintsUsed: game.hintsUsed } } } : null;

  return (
    <main className="workspace" aria-labelledby="tab-game">
      <section className="pane pane-input" aria-label="Levels">
        <div className="pane-header"><h2>Levels</h2><button className="btn btn-sm" onClick={() => start(randomLevel())}><Icon name="dice" size={14} /> Random</button></div>
        <div className="pane-body">
          <p className="help">You are the scheduler. Click a transaction to execute its next operation. Get every transaction to <strong>COMMIT</strong> without ever forming a cycle in the wait-for graph.</p>
          {LEVELS.map((l) => (
            <div key={l.id} className={`card clickable ${l.id === level.id ? 'selected' : ''}`} onClick={() => start(l)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && start(l)}>
              <div className="row"><h3>{l.name}</h3><span className={`badge badge-${l.difficulty}`}>{l.difficulty}</span></div>
              <p>{l.description}</p>
              {best[l.id] != null && <span className="chip chip-committed">best {best[l.id]}</span>}
            </div>
          ))}
          {level.id.startsWith('R') && (
            <div className="card selected"><div className="row"><h3>{level.name}</h3><span className={`badge badge-${level.difficulty}`}>{level.difficulty}</span></div><p>{level.description}</p><pre style={{ margin: 0, fontSize: 12, fontFamily: 'var(--mono)' }}>{level.schedule}</pre></div>
          )}
        </div>
      </section>

      <section className="pane pane-viz" aria-label="Board">
        <div className="pane-header">
          <h2>{level.name}</h2>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={hint} disabled={game.status !== 'playing'} title="Costs 10 points"><Icon name="lightbulb" size={14} /> Hint</button>
            <button className="btn btn-sm" onClick={() => { setGame(undoMove(game)); setHints(null); }} disabled={game.moves.length === 0 || game.status !== 'playing'}><Icon name="undo" size={14} /> Undo</button>
            <button className="btn btn-sm" onClick={() => start(level)}><Icon name="restart" size={14} /> Restart</button>
            <ResultActions run={run} toast={toast} />
          </div>
        </div>
        <div className="pane-body">
          <div className="scorecard" aria-label="Score">
            <div className="stat"><div className="v">{game.score}</div><div className="l">score</div></div>
            <div className="stat"><div className="v">{game.moves.length}</div><div className="l">moves</div></div>
            <div className="stat"><div className="v">{game.waits}</div><div className="l">waits (−5)</div></div>
            <div className="stat"><div className="v">{game.hintsUsed}</div><div className="l">hints (−10)</div></div>
            <div className="stat"><div className="v">{game.committed.length}/{game.txns.length}</div><div className="l">committed</div></div>
          </div>

          {game.status === 'won' && <div className="overlay banner-ok">Level complete — all transactions committed! Score {game.score}</div>}
          {game.status === 'deadlock' && <div className="overlay banner-danger">Deadlock: {game.cycle.join(' → ')}. Undo is disabled — press Restart and try a different order.</div>}

          <div className="txn-cards" role="group" aria-label="Choose a transaction to run">
            {game.txns.map((t) => {
              const mv = moves.find((m) => m.txn === t);
              const st = game.committed.includes(t) ? 'committed' : game.blockedOp[t] ? 'blocked' : mv ? 'active' : 'idle';
              const h = hints?.[t];
              const cls = ['txn-card', h ? (h.safe ? 'hint-safe' : 'hint-unsafe') : ''].join(' ');
              const next = game.blockedOp[t] || game.pending[t][0];
              return (
                <button key={t} type="button" className={cls} disabled={!mv} onClick={() => play(t)} aria-label={`${t}: ${mv ? `run ${next.text}` : st}`}>
                  <div className="title"><span>{t}</span><span className={`chip chip-${st}`}>{st}</span></div>
                  <div className="next">{next ? (game.blockedOp[t] ? '⏳ ' : '→ ') + next.text.replace(/^T\d+: /, '') : 'done'}</div>
                  <div className="queue">{game.pending[t].slice(game.blockedOp[t] ? 0 : 1).map((o) => o.text.replace(/^T\d+: /, '')).join(' · ') || '—'}</div>
                  {h && <div style={{ fontSize: 12, fontWeight: 700, color: h.safe ? 'var(--ok)' : 'var(--danger)' }}>{h.immediateDeadlock ? '✗ deadlocks immediately' : h.safe ? '✓ safe move' : '✗ leads to unavoidable deadlock'}</div>}
                </button>
              );
            })}
          </div>

          <WaitForGraph step={lastStep} txns={game.txns} theme={theme} height={280} visible={active} emptyText="Click a transaction card to make your first move" />
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lock table</h3>
            <LockTable step={lastStep} resources={resources} />
          </div>
        </div>
      </section>

      <section className="pane pane-explain sticky" aria-label="Explanation">
        <div className="pane-header"><h2>Explanation</h2></div>
        <div className="pane-body">
          {game.steps.length === 0 ? <p className="empty">Tip: {level.tip}</p> : <StepExplanation steps={game.steps} index={game.steps.length - 1} />}
          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tutor</h3>
          <Tutor ctx={tutorCtx} />
        </div>
      </section>
    </main>
  );
}
