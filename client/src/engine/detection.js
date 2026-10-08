/**
 * detection.js — run a schedule under plain two-phase locking with
 * deadlock DETECTION: after every blocked request the wait-for graph is
 * searched for a cycle; if one exists a victim is rolled back and restarted.
 */
import { Scheduler, MAX_STEPS } from './scheduler.js';
import { VICTIM_POLICIES } from './explain.js';

/**
 * Pick the transaction to roll back.
 * @param {Scheduler} s
 * @param {string[]} cycle  ordered cycle (first === last)
 * @param {string} policy
 * @param {string} requester transaction whose request closed the cycle
 */
export function chooseVictim(s, cycle, policy, requester) {
  const members = [...new Set(cycle)];
  const ts = (t) => s.timestamp.get(t);
  const locks = (t) => s.lm.holdsOf(t).length;
  let victim;
  switch (policy) {
    case 'oldest':
      victim = members.reduce((a, b) => (ts(a) < ts(b) ? a : b));
      break;
    case 'fewestLocks':
      victim = members.reduce((a, b) => (locks(a) < locks(b) || (locks(a) === locks(b) && ts(a) > ts(b)) ? a : b));
      break;
    case 'requester':
      victim = members.includes(requester) ? requester : members[members.length - 1];
      break;
    case 'youngest':
    default:
      victim = members.reduce((a, b) => (ts(a) > ts(b) ? a : b));
  }
  const p = VICTIM_POLICIES[policy] || VICTIM_POLICIES.youngest;
  return { victim, policyLabel: p.label, reason: p.describe(victim, locks(victim)) };
}

/**
 * @param {import('./parser.js').Op[]} ops
 * @param {string[]} txns
 * @param {{victimPolicy?: 'youngest'|'oldest'|'fewestLocks'|'requester'}} [options]
 */
export function simulateDetection(ops, txns, options = {}) {
  const policy = options.victimPolicy || 'youngest';
  const s = new Scheduler(ops, txns);
  let guard = 0;

  while (s.steps.length < MAX_STEPS && guard++ < MAX_STEPS * 2) {
    const op = s.nextOp();
    if (!op) break;

    if (op.type === 'UNLOCK') { s.executeUnlock(op); continue; }
    if (op.type === 'COMMIT' || op.type === 'ABORT') { s.executeCommit(op); continue; }

    // LOCK
    const r = s.lm.request(op.txn, op.res, op.mode);
    if (r.granted) {
      s.done.get(op.txn).push(op);
      s.record('GRANT', op, { meta: { upgrade: r.upgrade, redundant: r.redundant, holds: s.lm.holdsOf(op.txn).map((h) => `${h.mode}(${h.res})`) } });
      continue;
    }

    s.blockedOp.set(op.txn, op);
    const dfs = s.runCycleCheck();
    s.record('BLOCK', op, { dfs, meta: { blockedBy: r.blockedBy, upgrade: r.upgrade } });

    if (dfs.cycle) {
      s.deadlocks++;
      s.record('DEADLOCK_DETECTED', null, { cycle: dfs.cycle, meta: { requester: op.txn } });
      const { victim, policyLabel, reason } = chooseVictim(s, dfs.cycle, policy, op.txn);
      const { released, grants, restartOps } = s.rollback(victim);
      s.record('VICTIM', null, { txn: victim, granted: grants, meta: { policyLabel, reason, released, cycle: dfs.cycle } });
      if (s.restarts.get(victim) <= 3) s.scheduleRestart(victim, restartOps);
    }
  }
  s.finish();
  return { mode: 'detection', options: { victimPolicy: policy }, steps: s.steps, summary: s.summary(), txns };
}
