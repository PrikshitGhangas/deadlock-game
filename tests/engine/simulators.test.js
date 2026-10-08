import { describe, it, expect } from 'vitest';
import { parseSchedule, parseBankers } from '../../client/src/engine/parser.js';
import { simulateDetection } from '../../client/src/engine/detection.js';
import { simulatePrevention } from '../../client/src/engine/prevention.js';
import { isSafe, requestResources, simulateBankers } from '../../client/src/engine/bankers.js';
import { SAMPLES, sampleById } from '../../client/src/engine/samples.js';
import { findCycle } from '../../client/src/engine/waitForGraph.js';

const run = (id, opts) => {
  const s = sampleById(id);
  const p = parseSchedule(s.input.schedule);
  expect(p.ok).toBe(true);
  return { s, p, r: simulateDetection(p.ops, p.txns, opts ?? { victimPolicy: s.input.victimPolicy }) };
};

describe('simulateDetection', () => {
  it('sample 1: classic 2-txn deadlock, youngest victim', () => {
    const { s, r } = run('classic-2');
    expect(r.summary.deadlocks).toBe(s.expected.deadlocks);
    const dl = r.steps.find((x) => x.event === 'DEADLOCK_DETECTED');
    expect(dl.cycle).toEqual(s.expected.cycle);
    expect(r.steps.find((x) => x.event === 'VICTIM').txn).toBe(s.expected.victim);
    expect(r.summary.committed.sort()).toEqual(s.expected.committed);
    expect(r.steps.at(-1).event).toBe('END');
    // BLOCK steps carry a DFS trace for animation
    expect(r.steps.find((x) => x.event === 'BLOCK').dfs.length).toBeGreaterThan(0);
  });

  it('sample 2: three-transaction ring', () => {
    const { s, r } = run('ring-3');
    const dl = r.steps.find((x) => x.event === 'DEADLOCK_DETECTED');
    expect(dl.cycle).toEqual(s.expected.cycle);
    expect(r.steps.find((x) => x.event === 'VICTIM').txn).toBe('T3');
    expect(r.summary.committed.sort()).toEqual(['T1', 'T2', 'T3']);
  });

  it('sample 3: shared readers never deadlock', () => {
    const { r } = run('readers-ok');
    expect(r.summary.deadlocks).toBe(0);
    expect(r.summary.rollbacks).toBe(0);
    expect(r.summary.committed.sort()).toEqual(['T1', 'T2', 'T3']);
    for (const st of r.steps) expect(findCycle(st.wfg).cycle).toBeNull();
    const block = r.steps.find((x) => x.event === 'BLOCK');
    expect(block.txn).toBe('T3');
    expect(block.wfg.edges.map((e) => e.to).sort()).toEqual(['T1', 'T2']);
  });

  it('sample 7: lock upgrade deadlock', () => {
    const { r } = run('upgrade-deadlock');
    expect(r.summary.deadlocks).toBe(1);
    expect(r.steps.find((x) => x.event === 'DEADLOCK_DETECTED').cycle).toEqual(['T1', 'T2', 'T1']);
    expect(r.summary.committed.sort()).toEqual(['T1', 'T2']);
  });

  it('victim policies pick different transactions', () => {
    expect(run('classic-2', { victimPolicy: 'oldest' }).r.steps.find((x) => x.event === 'VICTIM').txn).toBe('T1');
    expect(run('classic-2', { victimPolicy: 'requester' }).r.steps.find((x) => x.event === 'VICTIM').txn).toBe('T2');
  });

  it('reports stuck transactions when locks are never released', () => {
    const p = parseSchedule('T1: LOCK-X(A)\nT2: LOCK-X(A)');
    const r = simulateDetection(p.ops, p.txns);
    expect(r.summary.stuck).toEqual(['T2']);
    expect(r.steps.at(-1).explanation.title).toMatch(/still waiting/);
  });

  it('every step has an explanation', () => {
    for (const s of SAMPLES.filter((x) => x.mode === 'detection')) {
      const p = parseSchedule(s.input.schedule);
      const r = simulateDetection(p.ops, p.txns);
      for (const st of r.steps) {
        expect(st.explanation.title).toBeTruthy();
        expect(st.explanation.text).toBeTruthy();
      }
    }
  });
});

describe('simulatePrevention', () => {
  const p = parseSchedule(sampleById('prevention-compare').input.schedule);

  it('wait-die: younger requester dies', () => {
    const r = simulatePrevention(p.ops, p.txns, { scheme: 'wait-die' });
    const die = r.steps.find((x) => x.event === 'DIE');
    expect(die.txn).toBe('T2');
    expect(r.steps.find((x) => x.event === 'WAIT').txn).toBe('T1');
    expect(r.summary.rollbacks).toBe(1);
    expect(r.summary.deadlocks).toBe(0);
    expect(r.summary.committed.sort()).toEqual(['T1', 'T2']);
    // the aborted transaction re-executes all of its ops after restart
    const restartIdx = r.steps.findIndex((x) => x.event === 'RESTART');
    const after = r.steps.slice(restartIdx).filter((x) => x.txn === 'T2' && x.event === 'GRANT').map((x) => x.op.res);
    expect(after).toEqual(['B', 'A']);
  });

  it('wound-wait: older requester wounds younger holder', () => {
    const r = simulatePrevention(p.ops, p.txns, { scheme: 'wound-wait' });
    const w = r.steps.find((x) => x.event === 'WOUND');
    expect(w.txn).toBe('T1');
    expect(w.meta.victim).toBe('T2');
    expect(r.steps.some((x) => x.event === 'WAIT')).toBe(false);
    expect(r.summary.committed.sort()).toEqual(['T1', 'T2']);
  });

  it('edge case: younger requests lock held by older in wound-wait waits without wounding', () => {
    // T1 is older (TS=1), T2 is younger (TS=2). T2 requests lock held by T1.
    const pYounger = parseSchedule('T1: LOCK-X(A)\nT2: LOCK-X(B)\nT2: LOCK-X(A)\nT1: COMMIT\nT2: COMMIT');
    const r = simulatePrevention(pYounger.ops, pYounger.txns, { scheme: 'wound-wait' });
    const wait = r.steps.find((x) => x.event === 'WAIT' && x.txn === 'T2');
    expect(wait).toBeTruthy();
    expect(wait.meta.holder).toBe('T1');
    expect(r.steps.some((x) => x.event === 'WOUND')).toBe(false);
    expect(r.summary.committed.sort()).toEqual(['T1', 'T2']);
  });

  it('edge case: mixed older and younger holders in wound-wait wounds younger and waits for older', () => {
    // T1 (TS=1, older), T2 (TS=2, intermediate), T3 (TS=3, younger)
    // T1 and T3 both hold S(A). T2 requests X(A).
    const pMixed = parseSchedule('T1: LOCK-S(A)\nT2: LOCK-S(B)\nT3: LOCK-S(A)\nT2: LOCK-X(A)\nT1: COMMIT\nT2: COMMIT\nT3: COMMIT');
    const r = simulatePrevention(pMixed.ops, pMixed.txns, { scheme: 'wound-wait' });
    const wound = r.steps.find((x) => x.event === 'WOUND' && x.txn === 'T2');
    expect(wound).toBeTruthy();
    expect(wound.meta.victim).toContain('T3');
    const wait = r.steps.find((x) => x.event === 'WAIT' && x.txn === 'T2');
    expect(wait).toBeTruthy();
    expect(wait.meta.holder).toBe('T1');
  });

  it('never forms a cycle under either scheme', () => {
    for (const scheme of ['wait-die', 'wound-wait']) {
      for (const s of SAMPLES.filter((x) => x.input.schedule)) {
        const pp = parseSchedule(s.input.schedule);
        const r = simulatePrevention(pp.ops, pp.txns, { scheme });
        for (const st of r.steps) expect(findCycle(st.wfg).cycle).toBeNull();
        expect(r.summary.deadlocks).toBe(0);
      }
    }
  });
});

describe("Banker's algorithm", () => {
  const s5 = sampleById('bankers-safe');
  const base = parseBankers(s5.input);

  it('textbook example is safe with the expected sequence', () => {
    const r = isSafe(base);
    expect(r.safe).toBe(true);
    expect(r.sequence).toEqual(s5.expected.sequence);
    expect(r.steps[0].event).toBe('BANKER_INIT');
    expect(r.steps.at(-1).event).toBe('BANKER_SAFE');
  });

  it('grants P1 request (1,0,2)', () => {
    const r = requestResources(base, 1, [1, 0, 2]);
    expect(r.granted).toBe(true);
    expect(r.steps.at(-1).event).toBe('BANKER_GRANT');
    expect(r.state.available).toEqual([2, 3, 0]);
  });

  it('denies P0 request (0,2,0) as unsafe', () => {
    const r = requestResources(parseBankers(sampleById('bankers-unsafe').input), 0, [0, 2, 0]);
    expect(r.granted).toBe(false);
    expect(r.reason).toBe('unsafe');
  });

  it('rejects request exceeding need / available', () => {
    expect(requestResources(base, 1, [9, 0, 0]).reason).toBe('exceeds-need');
    expect(requestResources(base, 0, [4, 0, 0]).reason).toBe('exceeds-available');
  });

  it('detects an unsafe initial state', () => {
    const r = isSafe({ available: [0, 0, 0], max: [[1, 1, 1], [1, 1, 1]], allocation: [[0, 0, 0], [0, 0, 0]] });
    expect(r.safe).toBe(false);
    expect(r.steps.at(-1).event).toBe('BANKER_UNSAFE');
  });

  it('simulateBankers wraps both algorithms', () => {
    const r = simulateBankers(parseBankers(sampleById('bankers-unsafe').input));
    expect(r.summary.safe).toBe(true);
    expect(r.summary.request.granted).toBe(false);
    expect(r.steps.map((x) => x.index)).toEqual(r.steps.map((_, i) => i));
  });
});
