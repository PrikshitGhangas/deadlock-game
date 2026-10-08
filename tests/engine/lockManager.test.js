import { describe, it, expect } from 'vitest';
import { LockManager, compatible } from '../../client/src/engine/lockManager.js';

describe('LockManager', () => {
  it('has the S/X compatibility matrix', () => {
    expect(compatible('S', 'S')).toBe(true);
    expect(compatible('S', 'X')).toBe(false);
    expect(compatible('X', 'S')).toBe(false);
    expect(compatible('X', 'X')).toBe(false);
  });

  it('grants shared locks to many, blocks exclusive', () => {
    const lm = new LockManager();
    expect(lm.request('T1', 'A', 'S').granted).toBe(true);
    expect(lm.request('T2', 'A', 'S').granted).toBe(true);
    const r = lm.request('T3', 'A', 'X');
    expect(r.granted).toBe(false);
    expect(r.blockedBy.map((b) => b.txn).sort()).toEqual(['T1', 'T2']);
    expect(lm.waitsFor('T3').sort()).toEqual(['T1', 'T2']);
  });

  it('re-grants in FIFO order on release', () => {
    const lm = new LockManager();
    lm.request('T1', 'A', 'X');
    lm.request('T2', 'A', 'X');
    lm.request('T3', 'A', 'X');
    const { grants } = lm.release('T1', 'A');
    expect(grants).toEqual([{ txn: 'T2', res: 'A', mode: 'X' }]);
    expect(lm.isBlocked('T3')).toBe(true);
  });

  it('handles upgrades', () => {
    const lm = new LockManager();
    lm.request('T1', 'A', 'S');
    const up = lm.request('T1', 'A', 'X');
    expect(up.granted).toBe(true);
    expect(up.upgrade).toBe(true);
    lm.request('T2', 'B', 'S');
    lm.request('T3', 'B', 'S');
    expect(lm.request('T2', 'B', 'X').granted).toBe(false);
    const { grants } = lm.releaseAll('T3');
    expect(grants).toEqual([{ txn: 'T2', res: 'B', mode: 'X' }]);
  });

  it('maintains FIFO order among multiple upgrade requests', () => {
    const lm = new LockManager();
    lm.request('T1', 'A', 'S');
    lm.request('T2', 'A', 'S');
    lm.request('T3', 'A', 'S');
    // T1 requests upgrade first, then T2 requests upgrade
    expect(lm.request('T1', 'A', 'X').granted).toBe(false);
    expect(lm.request('T2', 'A', 'X').granted).toBe(false);
    // Queue should have T1 ahead of T2
    const queue = lm.entry('A').queue;
    expect(queue[0].txn).toBe('T1');
    expect(queue[1].txn).toBe('T2');
  });

  it('treats repeated requests as redundant', () => {
    const lm = new LockManager();
    lm.request('T1', 'A', 'X');
    expect(lm.request('T1', 'A', 'S').redundant).toBe(true);
  });

  it('releaseAll clears holders and queue entries', () => {
    const lm = new LockManager();
    lm.request('T1', 'A', 'X');
    lm.request('T2', 'A', 'X');
    lm.request('T2', 'B', 'X');
    const { released } = lm.releaseAll('T2');
    expect(released).toEqual([{ res: 'B', mode: 'X' }]);
    expect(lm.snapshot().A.queue).toEqual([]);
  });

  it('clone is independent', () => {
    const lm = new LockManager();
    lm.request('T1', 'A', 'X');
    const c = lm.clone();
    c.release('T1', 'A');
    expect(lm.holdsOf('T1')).toHaveLength(1);
  });
});
