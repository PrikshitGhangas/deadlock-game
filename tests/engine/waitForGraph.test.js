import { describe, it, expect } from 'vitest';
import { LockManager } from '../../client/src/engine/lockManager.js';
import { buildWFG, findCycle, naturalCompare } from '../../client/src/engine/waitForGraph.js';

describe('waitForGraph', () => {
  it('builds edges from waiters to holders', () => {
    const lm = new LockManager();
    lm.request('T1', 'A', 'X');
    lm.request('T2', 'A', 'S');
    const g = buildWFG(lm, ['T1', 'T2', 'T3']);
    expect(g.nodes).toEqual(['T1', 'T2', 'T3']);
    expect(g.edges).toEqual([{ from: 'T2', to: 'T1', res: 'A' }]);
  });

  it('finds no cycle in a chain', () => {
    const r = findCycle({ nodes: ['T1', 'T2', 'T3'], edges: [{ from: 'T1', to: 'T2' }, { from: 'T2', to: 'T3' }] });
    expect(r.cycle).toBeNull();
    expect(r.trace.filter((t) => t.type === 'visit')).toHaveLength(3);
  });

  it('finds a 2-cycle', () => {
    const r = findCycle({ nodes: ['T1', 'T2'], edges: [{ from: 'T1', to: 'T2' }, { from: 'T2', to: 'T1' }] });
    expect(r.cycle).toEqual(['T1', 'T2', 'T1']);
    expect(r.trace.at(-1).type).toBe('cycleFound');
  });

  it('finds a 3-cycle reachable from another node', () => {
    const r = findCycle({
      nodes: ['T1', 'T2', 'T3', 'T4'],
      edges: [{ from: 'T1', to: 'T2' }, { from: 'T2', to: 'T3' }, { from: 'T3', to: 'T4' }, { from: 'T4', to: 'T2' }],
    });
    expect(r.cycle).toEqual(['T2', 'T3', 'T4', 'T2']);
  });

  it('sorts naturally', () => {
    expect(['T10', 'T2', 'T1'].sort(naturalCompare)).toEqual(['T1', 'T2', 'T10']);
  });
});
