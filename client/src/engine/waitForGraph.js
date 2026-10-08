/**
 * waitForGraph.js — build the wait-for graph (WFG) from a lock manager and
 * detect cycles with an iterative depth-first search.
 *
 * Node  = transaction.
 * Edge  Ti -> Tj  means "Ti is waiting for a lock currently held by Tj".
 * A cycle in the WFG is exactly a deadlock.
 *
 * Complexity: buildWFG is O(R * T) over the lock table; findCycle is O(V + E).
 */

/**
 * @typedef {Object} WFG
 * @property {string[]} nodes
 * @property {{from:string, to:string, res:string}[]} edges
 */

/**
 * @param {import('./lockManager.js').LockManager} lm
 * @param {string[]} [allTxns] optional list to include idle transactions as nodes
 * @returns {WFG}
 */
export function buildWFG(lm, allTxns = []) {
  const nodes = new Set(allTxns);
  const edges = [];
  for (const t of lm.transactions()) nodes.add(t);
  for (const t of nodes) {
    const w = lm.waitingRequest(t);
    if (!w) continue;
    for (const c of lm.conflicts(t, w.res, w.mode)) {
      edges.push({ from: t, to: c.txn, res: w.res });
    }
  }
  return { nodes: [...nodes], edges };
}

/**
 * Iterative DFS with white/grey/black colouring.
 * Returns the first cycle found (as an ordered list of nodes, first == last) and a
 * trace of visit / backtrack / cycle events the UI can animate.
 *
 * @param {WFG} wfg
 * @returns {{cycle: string[]|null, trace: {type:'visit'|'backtrack'|'cycleFound'|'edge', node?:string, from?:string, to?:string, cycle?:string[]}[]}}
 */
export function findCycle(wfg) {
  const adj = new Map();
  for (const n of wfg.nodes) adj.set(n, []);
  for (const e of wfg.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from).push(e.to);
  }
  const colour = new Map([...adj.keys()].map((n) => [n, 'white']));
  const trace = [];
  const order = [...adj.keys()].sort(naturalCompare);

  for (const start of order) {
    if (colour.get(start) !== 'white') continue;
    /** stack of [node, nextChildIndex] */
    const stack = [[start, 0]];
    const path = [start];
    colour.set(start, 'grey');
    trace.push({ type: 'visit', node: start });

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const [node] = frame;
      const children = adj.get(node);
      if (frame[1] < children.length) {
        const next = children[frame[1]++];
        trace.push({ type: 'edge', from: node, to: next });
        const c = colour.get(next);
        if (c === 'grey') {
          const cycle = path.slice(path.indexOf(next)).concat(next);
          trace.push({ type: 'cycleFound', cycle });
          return { cycle, trace };
        }
        if (c === 'white') {
          colour.set(next, 'grey');
          path.push(next);
          stack.push([next, 0]);
          trace.push({ type: 'visit', node: next });
        }
      } else {
        colour.set(node, 'black');
        path.pop();
        stack.pop();
        trace.push({ type: 'backtrack', node });
      }
    }
  }
  return { cycle: null, trace };
}

/** Sort "T2" before "T10". */
export function naturalCompare(a, b) {
  const na = parseInt(String(a).replace(/\D/g, ''), 10);
  const nb = parseInt(String(b).replace(/\D/g, ''), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}
