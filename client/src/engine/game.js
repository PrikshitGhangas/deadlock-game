/**
 * game.js — "You are the scheduler" game.
 *
 * The player chooses which transaction executes its next operation. Locks are
 * granted / blocked exactly as in the detection simulator. If the wait-for
 * graph ever contains a cycle the level is lost; if every transaction commits
 * the level is won. Hints are computed by exhaustively searching the (small)
 * state space for a deadlock-free completion.
 */
import { LockManager } from './lockManager.js';
import { buildWFG, findCycle } from './waitForGraph.js';
import { parseSchedule } from './parser.js';
import { explain } from './explain.js';

/** @typedef {{id:string, name:string, difficulty:'easy'|'medium'|'hard', description:string, schedule:string, tip:string}} Level */

/** @type {Level[]} */
export const LEVELS = [
  {
    id: 'L1', name: 'First steps', difficulty: 'easy',
    description: 'Two transactions want the same two accounts in opposite order. Get both to commit without a deadlock.',
    schedule: 'T1: LOCK-X(A)\nT1: LOCK-X(B)\nT1: COMMIT\nT2: LOCK-X(B)\nT2: LOCK-X(A)\nT2: COMMIT',
    tip: 'Interleaving the first two lock requests is the classic mistake — let one transaction finish first.',
  },
  {
    id: 'L2', name: 'Shared readers', difficulty: 'easy',
    description: 'Readers can share, writers cannot. Find an order where nobody waits on a cycle.',
    schedule: 'T1: LOCK-S(A)\nT1: LOCK-X(B)\nT1: COMMIT\nT2: LOCK-S(B)\nT2: LOCK-X(A)\nT2: COMMIT\nT3: LOCK-S(A)\nT3: COMMIT',
    tip: 'T1 and T3 can both read A at the same time. Only T2 needs A exclusively — and T1 needs B exclusively. Watch that pair.',
  },
  {
    id: 'L3', name: 'Three-way ring', difficulty: 'medium',
    description: 'Three transactions, three resources, one ring. One wrong click closes the cycle.',
    schedule: 'T1: LOCK-X(A)\nT1: LOCK-X(B)\nT1: COMMIT\nT2: LOCK-X(B)\nT2: LOCK-X(C)\nT2: COMMIT\nT3: LOCK-X(C)\nT3: LOCK-X(A)\nT3: COMMIT',
    tip: 'A cycle needs every transaction to hold something and wait for something. Break the ring by finishing one transaction early.',
  },
  {
    id: 'L4', name: 'Upgrade trap', difficulty: 'medium',
    description: 'Both transactions read A and then want to write it. Lock upgrades are a famous deadlock source.',
    schedule: 'T1: LOCK-S(A)\nT1: LOCK-X(A)\nT1: COMMIT\nT2: LOCK-S(A)\nT2: LOCK-X(A)\nT2: COMMIT',
    tip: 'If both hold S(A), neither can upgrade. Let one transaction upgrade before the other reads.',
  },
  {
    id: 'L5', name: 'Bank transfer', difficulty: 'hard',
    description: 'Two transfers in opposite directions plus an auditor reading balances. Keep everyone moving.',
    schedule: 'T1: LOCK-X(ACC1)\nT1: LOCK-X(ACC2)\nT1: UNLOCK(ACC1)\nT1: COMMIT\nT2: LOCK-X(ACC2)\nT2: LOCK-X(ACC1)\nT2: COMMIT\nT3: LOCK-S(ACC1)\nT3: LOCK-S(ACC2)\nT3: COMMIT',
    tip: 'T1 releases ACC1 early — use that window for the auditor.',
  },
  {
    id: 'L6', name: 'Four-way junction', difficulty: 'hard',
    description: 'Four transactions crossing a junction of four resources. Only a few orderings finish deadlock-free with minimal waiting.',
    schedule: 'T1: LOCK-X(N)\nT1: LOCK-X(E)\nT1: COMMIT\nT2: LOCK-X(E)\nT2: LOCK-X(S)\nT2: COMMIT\nT3: LOCK-X(S)\nT3: LOCK-X(W)\nT3: COMMIT\nT4: LOCK-X(W)\nT4: LOCK-X(N)\nT4: COMMIT',
    tip: 'Think of it as a traffic junction: let cars through one at a time, or in non-conflicting pairs (T1 & T3, T2 & T4).',
  },
];

/** Deterministic pseudo-random generator so "random" levels can be replayed by seed. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Build a random level; guaranteed to contain a potential deadlock. */
export function randomLevel(seed = Date.now() % 100000) {
  const rand = rng(seed);
  const nTxn = 2 + Math.floor(rand() * 3); // 2..4
  const resources = ['A', 'B', 'C', 'D'].slice(0, 2 + Math.floor(rand() * 3));
  const lines = [];
  for (let i = 1; i <= nTxn; i++) {
    const count = 2 + Math.floor(rand() * 2);
    const pool = resources.slice();
    const used = [];
    for (let k = 0; k < count && pool.length; k++) {
      const idx = Math.floor(rand() * pool.length);
      const res = pool.splice(idx, 1)[0];
      used.push(res);
      const mode = rand() < 0.7 ? 'X' : 'S';
      lines.push(`T${i}: LOCK-${mode}(${res})`);
    }
    lines.push(`T${i}: COMMIT`);
  }
  // Ensure a deadlock is possible: make T1 and T2 request the first two resources in opposite order, exclusively.
  const [r1, r2] = resources;
  const filtered = lines.filter((l) => !l.startsWith('T1:') && !l.startsWith('T2:'));
  filtered.unshift(`T1: LOCK-X(${r1})`, `T1: LOCK-X(${r2})`, 'T1: COMMIT', `T2: LOCK-X(${r2})`, `T2: LOCK-X(${r1})`, 'T2: COMMIT');
  return {
    id: `R${seed}`, name: `Random #${seed}`, difficulty: nTxn <= 2 ? 'easy' : nTxn === 3 ? 'medium' : 'hard',
    description: `${nTxn} random transactions over ${resources.length} resources (seed ${seed}).`,
    schedule: filtered.join('\n'),
    tip: 'Look for two transactions that hold what the other wants — never let both get their first lock before one finishes.',
  };
}

/** Internal mutable state → serialisable snapshot for React. */
export function createGame(level) {
  const parsed = parseSchedule(level.schedule);
  if (!parsed.ok) throw new Error('Level schedule invalid: ' + parsed.errors.map((e) => e.msg).join('; '));
  const pending = {};
  for (const t of parsed.txns) pending[t] = parsed.ops.filter((o) => o.txn === t);
  return {
    level,
    txns: parsed.txns,
    lm: new LockManager(),
    pending,
    done: Object.fromEntries(parsed.txns.map((t) => [t, []])),
    blockedOp: {},
    committed: [],
    status: 'playing',
    cycle: null,
    moves: [],
    steps: [],
    waits: 0,
    hintsUsed: 0,
    score: 100,
  };
}

function cloneState(g) {
  return {
    ...g,
    lm: g.lm.clone(),
    pending: Object.fromEntries(Object.entries(g.pending).map(([k, v]) => [k, v.slice()])),
    done: Object.fromEntries(Object.entries(g.done).map(([k, v]) => [k, v.slice()])),
    blockedOp: { ...g.blockedOp },
    committed: g.committed.slice(),
    moves: g.moves.slice(),
    steps: g.steps.slice(),
  };
}

/** Transactions the player can click right now, with the op that would run. */
export function availableMoves(g) {
  if (g.status !== 'playing') return [];
  return g.txns
    .filter((t) => !g.blockedOp[t] && !g.committed.includes(t) && g.pending[t].length > 0)
    .map((t) => ({ txn: t, op: g.pending[t][0] }));
}

function applyGrants(g, grants) {
  for (const gr of grants) {
    const op = g.blockedOp[gr.txn];
    if (op) {
      delete g.blockedOp[gr.txn];
      g.done[gr.txn].push(op);
    }
  }
}

function snapshot(g, event, txn, op, meta, granted = [], dfs = null) {
  const wfg = buildWFG(g.lm, g.txns);
  const step = {
    index: g.steps.length,
    event,
    op: op ? { ...op } : null,
    txn,
    lockTable: g.lm.snapshot(),
    wfg,
    dfs: dfs ? dfs.trace : null,
    cycle: dfs ? dfs.cycle : null,
    blocked: Object.keys(g.blockedOp),
    committed: g.committed.slice(),
    aborted: [],
    statuses: Object.fromEntries(g.txns.map((t) => [t, g.committed.includes(t) ? 'committed' : g.blockedOp[t] ? 'blocked' : g.pending[t].length ? 'active' : 'idle'])),
    granted,
    meta,
    explanation: null,
  };
  step.explanation = explain(step);
  g.steps.push(step);
  return step;
}

/**
 * Execute the next op of `txn`. Pure: returns a new state.
 * @returns {{state: object, step: object}}
 */
export function applyMove(state, txn) {
  const g = cloneState(state);
  if (g.status !== 'playing' || g.blockedOp[txn] || g.committed.includes(txn) || !g.pending[txn].length) {
    return { state, step: null };
  }
  const op = g.pending[txn].shift();
  g.moves.push({ txn, op });
  let step;

  if (op.type === 'LOCK') {
    const r = g.lm.request(txn, op.res, op.mode);
    if (r.granted) {
      g.done[txn].push(op);
      step = snapshot(g, 'GAME_MOVE', txn, op, {
        kind: 'grant',
        title: `${txn} acquires ${op.mode}(${op.res})`,
        text: `${txn} locks ${op.res} in ${op.mode === 'X' ? 'exclusive' : 'shared'} mode. No conflict, so it continues.`,
        why: 'Locks that are granted immediately never create wait-for edges.',
      });
    } else {
      g.blockedOp[txn] = op;
      g.waits++;
      const dfs = findCycle(buildWFG(g.lm, g.txns));
      const by = r.blockedBy.map((b) => b.txn).join(', ');
      if (dfs.cycle) {
        g.status = 'deadlock';
        g.cycle = dfs.cycle;
        g.score = 0;
        step = snapshot(g, 'GAME_MOVE', txn, op, {
          kind: 'deadlock',
          title: `Deadlock! ${dfs.cycle.join(' → ')}`,
          text: `${txn} wanted ${op.mode}(${op.res}) held by ${by}, and ${by} is (transitively) waiting for ${txn}. The wait-for graph now has the cycle ${dfs.cycle.join(' → ')} — nobody in it can ever proceed. Level failed.`,
          why: 'This is exactly what a DBMS deadlock detector looks for. A real system would now abort one transaction.',
        }, [], dfs);
      } else {
        g.score = Math.max(0, g.score - 5);
        step = snapshot(g, 'GAME_MOVE', txn, op, {
          kind: 'block',
          title: `${txn} waits for ${op.res}`,
          text: `${txn} wants ${op.mode}(${op.res}) but ${by} holds a conflicting lock. ${txn} joins the wait queue (edge ${txn} → ${by}). No cycle yet, but waiting costs 5 points.`,
          why: 'A wait is not a deadlock — but every wait is a potential edge in a future cycle.',
        }, [], dfs);
      }
    }
  } else if (op.type === 'UNLOCK') {
    const { grants } = g.lm.release(txn, op.res);
    applyGrants(g, grants);
    g.done[txn].push(op);
    step = snapshot(g, 'GAME_MOVE', txn, op, {
      kind: 'unlock',
      title: `${txn} releases ${op.res}`,
      text: `${txn} unlocks ${op.res}.` + (grants.length ? ` ${grants.map((x) => x.txn).join(', ')} wake up and get their lock.` : ' Nobody was waiting.'),
      why: 'Releasing a lock removes wait-for edges pointing at this transaction.',
    }, grants);
  } else {
    const { released, grants } = g.lm.releaseAll(txn);
    applyGrants(g, grants);
    g.committed.push(txn);
    g.done[txn].push(op);
    const allDone = g.txns.every((t) => g.committed.includes(t));
    if (allDone) {
      g.status = 'won';
      if (g.waits === 0) g.score += 20;
    }
    step = snapshot(g, 'GAME_MOVE', txn, op, {
      kind: allDone ? 'won' : 'commit',
      title: allDone ? `${txn} commits — level complete!` : `${txn} commits`,
      text: `${txn} commits and releases ${released.map((r) => `${r.mode}(${r.res})`).join(', ') || 'nothing'}.` +
        (grants.length ? ` ${grants.map((x) => x.txn).join(', ')} wake up.` : '') +
        (allDone ? ` All transactions committed with ${g.waits} wait${g.waits === 1 ? '' : 's'}. Score: ${g.score}.` : ''),
      why: allDone ? 'A schedule where every transaction commits and no cycle ever formed is deadlock-free.' : 'Commit releases all locks at once (strict 2PL).',
    }, grants);
  }
  return { state: g, step };
}

/** Compact key for memoising the search. */
function stateKey(g) {
  const lt = Object.entries(g.lm.snapshot()).sort().map(([r, e]) => `${r}:${e.holders.map((h) => h.txn + h.mode).sort().join('')}|${e.queue.map((q) => q.txn + q.mode).join('')}`).join(';');
  const pend = g.txns.map((t) => g.pending[t].length).join(',');
  return `${lt}#${pend}#${Object.keys(g.blockedOp).sort().join(',')}`;
}

/**
 * Exhaustive search: can the game still be won from this state?
 * State space is tiny (≤ 4 txns × ≤ 5 ops) so this is instant.
 */
export function isWinnable(g, memo = new Map()) {
  if (g.status === 'won') return true;
  if (g.status === 'deadlock') return false;
  const key = stateKey(g);
  if (memo.has(key)) return memo.get(key);
  memo.set(key, false); // cycle guard
  const moves = availableMoves(g);
  if (moves.length === 0) { memo.set(key, false); return false; } // everyone stuck (shouldn't happen without a cycle)
  for (const mv of moves) {
    const { state } = applyMove(g, mv.txn);
    if (isWinnable(state, memo)) { memo.set(key, true); return true; }
  }
  memo.set(key, false);
  return false;
}

/** For each available move, whether it keeps a win reachable. Increments hintsUsed. */
export function computeHints(state) {
  const memo = new Map();
  const hints = availableMoves(state).map((mv) => {
    const { state: next } = applyMove(state, mv.txn);
    const immediateDeadlock = next.status === 'deadlock';
    return { txn: mv.txn, op: mv.op, safe: !immediateDeadlock && isWinnable(next, memo), immediateDeadlock };
  });
  const g = cloneState(state);
  g.hintsUsed++;
  g.score = Math.max(0, g.score - 10);
  return { state: g, hints };
}

/** Undo the last move by replaying from the start. */
export function undoMove(state) {
  if (state.moves.length === 0) return state;
  let g = createGame(state.level);
  g.hintsUsed = state.hintsUsed;
  g.score = 100 - 10 * state.hintsUsed;
  for (const mv of state.moves.slice(0, -1)) g = applyMove(g, mv.txn).state;
  return g;
}
