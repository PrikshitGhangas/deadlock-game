/**
 * lockManager.js — a small two-mode (S/X) lock manager with FIFO wait queues.
 *
 * Compatibility matrix:        S     X
 *                         S   yes    no
 *                         X   no     no
 *
 * A request is granted when it is compatible with every *other* current holder.
 * Waiting requests are re-examined in FIFO order whenever a lock is released.
 */

/** @typedef {'S'|'X'} Mode */

export function compatible(held, requested) {
  return held === 'S' && requested === 'S';
}

export class LockManager {
  constructor() {
    /** @type {Map<string, {holders: Map<string, Mode>, queue: {txn:string, mode:Mode}[]}>} */
    this.locks = new Map();
  }

  entry(res) {
    if (!this.locks.has(res)) this.locks.set(res, { holders: new Map(), queue: [] });
    return this.locks.get(res);
  }

  /** Holders of `res` (other than `txn`) whose mode conflicts with `mode`. */
  conflicts(txn, res, mode) {
    const e = this.entry(res);
    const out = [];
    for (const [holder, held] of e.holders) {
      if (holder !== txn && !compatible(held, mode)) out.push({ txn: holder, mode: held });
    }
    return out;
  }

  /**
   * Request a lock.
   * @returns {{granted: boolean, upgrade: boolean, blockedBy: {txn:string, mode:Mode}[], redundant: boolean}}
   */
  request(txn, res, mode) {
    const e = this.entry(res);
    const held = e.holders.get(txn);
    if (held === 'X' || (held === 'S' && mode === 'S')) {
      return { granted: true, upgrade: false, blockedBy: [], redundant: true };
    }
    const upgrade = held === 'S' && mode === 'X';
    const blockedBy = this.conflicts(txn, res, mode);
    if (blockedBy.length === 0) {
      e.holders.set(txn, mode);
      return { granted: true, upgrade, blockedBy: [], redundant: false };
    }
    // Check if txn is already queued for this resource
    const existingIdx = e.queue.findIndex((q) => q.txn === txn);
    if (existingIdx >= 0) {
      if (mode === 'X' && e.queue[existingIdx].mode === 'S') {
        e.queue[existingIdx].mode = 'X';
      }
      return { granted: false, upgrade, blockedBy, redundant: false };
    }

    // Upgrades are placed ahead of standard waiters, but maintain FIFO order among multiple upgrading transactions
    if (upgrade) {
      const lastUpgradeIdx = e.queue.findLastIndex((q) => q.upgrade);
      const insertAt = lastUpgradeIdx >= 0 ? lastUpgradeIdx + 1 : 0;
      e.queue.splice(insertAt, 0, { txn, mode, upgrade: true });
    } else {
      e.queue.push({ txn, mode, upgrade: false });
    }
    return { granted: false, upgrade, blockedBy, redundant: false };
  }

  /** Re-scan a queue and grant every request that is now compatible. Returns the grants. */
  processQueue(res) {
    const e = this.entry(res);
    const grants = [];
    const remaining = [];
    let blockedExclusive = false;

    for (const w of e.queue) {
      // If an earlier request in the queue is blocked for an exclusive lock, prevent subsequent
      // incompatible requests from jumping ahead and starving the waiting writer
      if (blockedExclusive && !compatible('S', w.mode)) {
        remaining.push(w);
        continue;
      }

      if (this.conflicts(w.txn, res, w.mode).length === 0) {
        e.holders.set(w.txn, w.mode);
        grants.push({ txn: w.txn, res, mode: w.mode });
      } else {
        remaining.push(w);
        if (w.mode === 'X') {
          blockedExclusive = true;
        }
      }
    }
    e.queue = remaining;
    return grants;
  }

  /** Release one lock. Returns the grants triggered by the release. */
  release(txn, res) {
    const e = this.entry(res);
    if (!e.holders.delete(txn)) return { released: false, grants: [] };
    return { released: true, grants: this.processQueue(res) };
  }

  /** Release everything a transaction holds or waits for (commit / abort). */
  releaseAll(txn) {
    const released = [];
    const grants = [];
    for (const [res, e] of this.locks) {
      e.queue = e.queue.filter((w) => w.txn !== txn);
      if (e.holders.has(txn)) {
        released.push({ res, mode: e.holders.get(txn) });
        e.holders.delete(txn);
      }
    }
    for (const { res } of released) grants.push(...this.processQueue(res));
    // Removing a waiter can also unblock nothing, but clearing a stale upgrade may — rescan all.
    for (const res of this.locks.keys()) {
      if (!released.some((r) => r.res === res)) grants.push(...this.processQueue(res));
    }
    return { released, grants };
  }

  /** Resources currently held by txn. */
  holdsOf(txn) {
    const out = [];
    for (const [res, e] of this.locks) if (e.holders.has(txn)) out.push({ res, mode: e.holders.get(txn) });
    return out;
  }

  /** The pending (blocked) request of txn, if any. */
  waitingRequest(txn) {
    for (const [res, e] of this.locks) {
      const w = e.queue.find((q) => q.txn === txn);
      if (w) return { res, mode: w.mode };
    }
    return null;
  }

  isBlocked(txn) {
    return this.waitingRequest(txn) !== null;
  }

  /** Transactions that txn is waiting on (holders conflicting with its pending request). */
  waitsFor(txn) {
    const w = this.waitingRequest(txn);
    if (!w) return [];
    return this.conflicts(txn, w.res, w.mode).map((c) => c.txn);
  }

  /** Every transaction that appears anywhere in the lock table. */
  transactions() {
    const set = new Set();
    for (const e of this.locks.values()) {
      for (const t of e.holders.keys()) set.add(t);
      for (const q of e.queue) set.add(q.txn);
    }
    return [...set];
  }

  /** Plain, serialisable copy of the table for a step snapshot. */
  snapshot() {
    const resources = {};
    for (const [res, e] of this.locks) {
      resources[res] = {
        holders: [...e.holders].map(([txn, mode]) => ({ txn, mode })),
        queue: e.queue.map((q) => ({ ...q })),
      };
    }
    return resources;
  }

  clone() {
    const c = new LockManager();
    for (const [res, e] of this.locks) {
      c.locks.set(res, { holders: new Map(e.holders), queue: e.queue.map((q) => ({ ...q })) });
    }
    return c;
  }
}
