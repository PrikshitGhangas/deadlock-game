/**
 * scheduler.js — shared machinery for running an interleaved schedule through
 * the lock manager and recording one snapshot ("step") per event.
 *
 * Both deadlock *detection* (detection.js) and *prevention* (prevention.js) use
 * this runner; they differ only in what happens when a lock request conflicts.
 */
import { LockManager } from './lockManager.js';
import { buildWFG, findCycle } from './waitForGraph.js';
import { explain } from './explain.js';

export const MAX_STEPS = 500;

export class Scheduler {
  /**
   * @param {import('./parser.js').Op[]} ops
   * @param {string[]} txns
   */
  constructor(ops, txns) {
    this.txns = txns;
    this.lm = new LockManager();
    this.remaining = ops.slice();
    /** @type {Map<string, import('./parser.js').Op[]>} executed ops (for restart) */
    this.done = new Map(txns.map((t) => [t, []]));
    /** @type {Map<string, import('./parser.js').Op>} op that a blocked txn is waiting on */
    this.blockedOp = new Map();
    this.committed = new Set();
    this.aborted = new Set(); // aborted and NOT yet restarted
    this.restarts = new Map(txns.map((t) => [t, 0]));
    /** timestamps = order of first appearance in the schedule */
    this.timestamp = new Map(txns.map((t, i) => [t, i + 1]));
    this.steps = [];
    this.deadlocks = 0;
    this.rollbacks = 0;
  }

  status(t) {
    if (this.committed.has(t)) return 'committed';
    if (this.aborted.has(t)) return 'aborted';
    if (this.blockedOp.has(t)) return 'blocked';
    if (this.done.get(t).length === 0 && !this.remaining.some((o) => o.txn === t)) return 'idle';
    return 'active';
  }

  /** Build and push a step snapshot. Returns the step. */
  record(event, op, extra = {}) {
    const wfg = buildWFG(this.lm, this.txns);
    const step = {
      index: this.steps.length,
      event,
      op: op ? { ...op } : null,
      txn: extra.txn ?? op?.txn ?? null,
      lockTable: this.lm.snapshot(),
      wfg,
      dfs: null,
      cycle: null,
      blocked: [...this.blockedOp.keys()],
      aborted: [...this.aborted],
      committed: [...this.committed],
      statuses: Object.fromEntries(this.txns.map((t) => [t, this.status(t)])),
      timestamps: Object.fromEntries(this.timestamp),
      granted: extra.granted ?? [],
      meta: extra.meta ?? {},
      explanation: null,
    };
    if (extra.dfs) {
      step.dfs = extra.dfs.trace;
      step.cycle = extra.dfs.cycle;
    }
    if (extra.cycle) step.cycle = extra.cycle;
    step.explanation = explain(step);
    this.steps.push(step);
    return step;
  }

  /** Apply wake-ups: transactions granted their pending lock are no longer blocked. */
  applyGrants(grants) {
    for (const g of grants) {
      const op = this.blockedOp.get(g.txn);
      if (op) {
        this.blockedOp.delete(g.txn);
        this.done.get(g.txn).push(op);
      }
    }
  }

  /**
   * Roll a transaction back: release everything and queue it for restart.
   * @param {string} txn
   * @param {import('./parser.js').Op} [currentOp] op the txn was executing when it was aborted (not yet blocked/done)
   */
  rollback(txn, currentOp = null) {
    const { released, grants } = this.lm.releaseAll(txn);
    const blocked = this.blockedOp.get(txn);
    this.blockedOp.delete(txn);
    const executed = this.done.get(txn);
    const future = this.remaining.filter((o) => o.txn === txn);
    this.remaining = this.remaining.filter((o) => o.txn !== txn);
    const inflight = blocked || currentOp;
    const restartOps = [...executed, ...(inflight ? [inflight] : []), ...future];
    this.done.set(txn, []);
    this.aborted.add(txn);
    this.restarts.set(txn, this.restarts.get(txn) + 1);
    this.rollbacks++;
    this.applyGrants(grants);
    return { released, grants, restartOps };
  }

  /** Put the rolled-back transaction's ops at the end of the schedule. */
  scheduleRestart(txn, restartOps) {
    this.remaining.push(...restartOps);
  }

  /** Next runnable op: first op whose txn is neither blocked nor committed. */
  nextOp() {
    for (let i = 0; i < this.remaining.length; i++) {
      const op = this.remaining[i];
      if (this.blockedOp.has(op.txn) || this.committed.has(op.txn)) continue;
      this.remaining.splice(i, 1);
      if (this.aborted.has(op.txn)) {
        // first op of a restarted transaction
        this.aborted.delete(op.txn);
        this.record('RESTART', null, { txn: op.txn, meta: { keepTimestamp: true } });
      }
      return op;
    }
    return null;
  }

  runCycleCheck() {
    return findCycle(buildWFG(this.lm, this.txns));
  }

  executeUnlock(op) {
    const { grants } = this.lm.release(op.txn, op.res);
    this.applyGrants(grants);
    this.done.get(op.txn).push(op);
    this.record('UNLOCK', op, { granted: grants });
  }

  executeCommit(op) {
    const { released, grants } = this.lm.releaseAll(op.txn);
    this.applyGrants(grants);
    this.committed.add(op.txn);
    this.done.get(op.txn).push(op);
    this.record(op.type, op, { granted: grants, meta: { released } });
  }

  finish() {
    const stuck = [...this.blockedOp.keys()];
    this.record('END', null, {
      meta: { stuck: stuck.length ? stuck : null, deadlocks: this.deadlocks, rollbacks: this.rollbacks },
    });
  }

  /** Summary for history / reports. */
  summary() {
    return {
      steps: this.steps.length,
      deadlocks: this.deadlocks,
      rollbacks: this.rollbacks,
      committed: [...this.committed],
      stuck: [...this.blockedOp.keys()],
    };
  }
}
