/**
 * precedenceGraph.js — Conflict Serializability and Precedence Graph Engine
 *
 * Checks if a concurrent transaction schedule is conflict serializable by:
 * 1. Extracting all read/write operations per transaction.
 * 2. Identifying conflicting operations on the same data item across distinct transactions:
 *    - Read-Write (R_i(X) < W_j(X))
 *    - Write-Read (W_i(X) < R_j(X))
 *    - Write-Write (W_i(X) < W_j(X))
 * 3. Constructing the directed Precedence (Serialization) Graph: T_i -> T_j.
 * 4. Detecting cycles using DFS. If acyclic -> Conflict Serializable, topological sort
 *    gives equivalent serial order(s). If cyclic -> Not Conflict Serializable.
 */

/**
 * Normalizes an operation string or object into standard { txn, type: 'R'|'W', item, index, raw }
 * Supports:
 * - "T1: R(A)", "T2: W(A)", "T1: READ A", "T2: WRITE B", "T1: LOCK-S(A)", "T1: LOCK-X(A)"
 * - Compact notation: "R1(A)", "W2(A)", "r1[A]", "w2[B]"
 */
export function parseScheduleOperations(input) {
  if (Array.isArray(input)) {
    return input.map((item, idx) => {
      if (typeof item === 'string') return parseOpLine(item, idx);
      const type = normalizeOpType(item.type || item.op || (item.mode === 'X' ? 'W' : 'R'));
      return {
        txn: String(item.txn || item.transaction || 'T1').toUpperCase(),
        type,
        item: String(item.item || item.res || 'A').toUpperCase(),
        index: idx,
        raw: item.text || `${item.txn}: ${type}(${item.item || item.res})`,
      };
    }).filter(Boolean);
  }

  const text = String(input ?? '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('--'));
  
  // Check if input is space-separated compact notation like "R1(A) W2(A) R2(B) W1(B)"
  if (lines.length === 1 && lines[0].includes(' ') && !lines[0].includes(':')) {
    const tokens = lines[0].split(/\s+/).filter(Boolean);
    return tokens.map((token, idx) => parseCompactToken(token, idx)).filter(Boolean);
  }

  // Otherwise line-by-line parsing
  const ops = [];
  let idx = 0;
  for (const line of lines) {
    // If line has multiple compact tokens, parse them
    if (!line.includes(':') && /[RW]\d+/i.test(line)) {
      const tokens = line.split(/\s+/).filter(Boolean);
      for (const tok of tokens) {
        const parsed = parseCompactToken(tok, idx++);
        if (parsed) ops.push(parsed);
      }
    } else {
      const parsed = parseOpLine(line, idx++);
      if (parsed) ops.push(parsed);
    }
  }
  return ops;
}

function normalizeOpType(str) {
  const s = String(str).toUpperCase().trim();
  if (s === 'R' || s === 'READ' || s === 'SELECT' || s === 'S' || s === 'LOCK-S') return 'R';
  if (s === 'W' || s === 'WRITE' || s === 'UPDATE' || s === 'INSERT' || s === 'DELETE' || s === 'X' || s === 'LOCK-X') return 'W';
  return null;
}

function parseCompactToken(tok, index) {
  const m = /^([RW])(\d+)(?:[\(\[]([A-Za-z_]\w*)[\)\]])?$/i.exec(tok.trim());
  if (!m) return null;
  const type = m[1].toUpperCase() === 'W' ? 'W' : 'R';
  const txn = `T${m[2]}`;
  const item = (m[3] || 'A').toUpperCase();
  return { txn, type, item, index, raw: tok };
}

function parseOpLine(line, index) {
  const clean = line.replace(/(#|--).*$/, '').trim();
  if (!clean) return null;

  // Compact token on line
  if (/^[RW]\d+[\(\[][A-Za-z_]\w*[\)\]]$/i.test(clean)) {
    return parseCompactToken(clean, index);
  }

  // T1: R(A) or T1: READ A or T1: LOCK-S(A)
  const lineMatch = /^\s*(T\d+|[A-Za-z]\w*)\s*:\s*(.+?)\s*$/i.exec(clean);
  if (!lineMatch) return null;
  const txn = lineMatch[1].toUpperCase();
  const rest = lineMatch[2].trim();

  // Check R(A) or W(A) or LOCK-X(A)
  const opMatch = /^(?:LOCK-?([SX])|([SX])|([RW]))\s*\(\s*([A-Za-z_]\w*)\s*\)$/i.exec(rest);
  if (opMatch) {
    const rawType = opMatch[1] || opMatch[2] || opMatch[3];
    const type = normalizeOpType(rawType);
    if (!type) return null;
    const item = opMatch[4].toUpperCase();
    return { txn, type, item, index, raw: line };
  }

  // SQL style: READ A or UPDATE A
  const sqlMatch = /^(READ|SELECT|WRITE|UPDATE|INSERT|DELETE)\s+([A-Za-z_]\w*)$/i.exec(rest);
  if (sqlMatch) {
    const type = normalizeOpType(sqlMatch[1]);
    if (!type) return null;
    const item = sqlMatch[2].toUpperCase();
    return { txn, type, item, index, raw: line };
  }

  return null;
}

/**
 * Analyzes a schedule for Conflict Serializability.
 *
 * @param {string|Array} scheduleInput
 * @returns {Object} result analysis with graph, conflicts, cycles, and equivalent serial order.
 */
export function analyzeConflictSerializability(scheduleInput) {
  const ops = parseScheduleOperations(scheduleInput);
  const txns = Array.from(new Set(ops.map(o => o.txn))).sort();
  const items = Array.from(new Set(ops.map(o => o.item))).sort();

  const conflicts = [];
  // Adjacency map for directed graph: fromTxn -> Set of toTxns
  const adj = new Map();
  const edgeDetails = new Map(); // "T1->T2" -> [{ type: 'R-W', item: 'A', op1, op2 }]

  for (const t of txns) {
    adj.set(t, new Set());
  }

  // Find conflicting pairs: i < j, Ti != Tj, same item, at least one Write
  for (let i = 0; i < ops.length; i++) {
    for (let j = i + 1; j < ops.length; j++) {
      const op1 = ops[i];
      const op2 = ops[j];

      if (op1.txn !== op2.txn && op1.item === op2.item) {
        if (op1.type === 'W' || op2.type === 'W') {
          const conflictType = `${op1.type}-${op2.type}`;
          const edgeKey = `${op1.txn}->${op2.txn}`;

          adj.get(op1.txn).add(op2.txn);

          if (!edgeDetails.has(edgeKey)) {
            edgeDetails.set(edgeKey, []);
          }

          const conflictRecord = {
            from: op1.txn,
            to: op2.txn,
            item: op1.item,
            type: conflictType,
            description: `${conflictType} conflict on item ${op1.item}: ${op1.txn} ${op1.type}(${op1.item}) at op #${op1.index + 1} precedes ${op2.txn} ${op2.type}(${op2.item}) at op #${op2.index + 1}`,
            op1,
            op2,
          };

          conflicts.push(conflictRecord);
          edgeDetails.get(edgeKey).push(conflictRecord);
        }
      }
    }
  }

  // Construct edges array for graph rendering
  const edges = [];
  for (const [from, neighbors] of adj.entries()) {
    for (const to of neighbors) {
      const details = edgeDetails.get(`${from}->${to}`) || [];
      const reasons = details.map(d => `${d.type}(${d.item})`).join(', ');
      edges.push({
        from,
        to,
        label: reasons,
        conflicts: details,
      });
    }
  }

  // Cycle detection via DFS with 3-color states: 0=unvisited, 1=visiting, 2=visited
  const color = new Map();
  const parent = new Map();
  for (const t of txns) color.set(t, 0);

  const cycles = [];
  let hasCycle = false;

  function dfs(u, path) {
    color.set(u, 1);
    const neighbors = Array.from(adj.get(u) || []).sort();

    for (const v of neighbors) {
      if (color.get(v) === 1) {
        // Back edge found -> cycle!
        hasCycle = true;
        const cyclePath = [];
        const cycleStartIndex = path.indexOf(v);
        if (cycleStartIndex !== -1) {
          cyclePath.push(...path.slice(cycleStartIndex), v);
        } else {
          cyclePath.push(u, v);
        }
        cycles.push(cyclePath);
      } else if (color.get(v) === 0) {
        parent.set(v, u);
        dfs(v, [...path, v]);
      }
    }
    color.set(u, 2);
  }

  for (const t of txns) {
    if (color.get(t) === 0) {
      dfs(t, [t]);
    }
  }

  // Topological sort (Kahn's algorithm) if acyclic
  let serialOrder = null;
  const inDegree = new Map();
  for (const t of txns) inDegree.set(t, 0);
  for (const [, neighbors] of adj.entries()) {
    for (const to of neighbors) {
      inDegree.set(to, inDegree.get(to) + 1);
    }
  }

  if (!hasCycle) {
    const queue = txns.filter(t => inDegree.get(t) === 0).sort();
    const sorted = [];
    const degCopy = new Map(inDegree);

    while (queue.length > 0) {
      const curr = queue.shift();
      sorted.push(curr);
      for (const next of adj.get(curr)) {
        degCopy.set(next, degCopy.get(next) - 1);
        if (degCopy.get(next) === 0) {
          queue.push(next);
          queue.sort(); // deterministic tie-breaking
        }
      }
    }

    if (sorted.length === txns.length) {
      serialOrder = sorted;
    }
  }

  return {
    isConflictSerializable: !hasCycle,
    txns,
    items,
    ops,
    conflicts,
    edges,
    hasCycle,
    cycles,
    equivalentSerialSchedule: serialOrder ? serialOrder.join(' -> ') : null,
    serialOrder,
    summary: !hasCycle
      ? `Schedule is Conflict Serializable! Precedence graph is acyclic. Equivalent serial order: ${serialOrder?.join(' -> ')}.`
      : `Schedule is NOT Conflict Serializable. Cycle detected in precedence graph: ${cycles[0]?.join(' -> ')}.`,
  };
}

/**
 * Generates a random schedule of transactions and returns the text and serializability status.
 */
export function generateRandomSchedule({
  numTxns = 3,
  numItems = 3,
  numOps = 8,
  conflictProbability = 0.6,
  seed = null,
} = {}) {
  // Simple deterministic pseudorandom number generator if seed provided
  let currentSeed = seed !== null ? Number(seed) : Math.floor(Math.random() * 1000000);
  function nextRand() {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  }

  const txnNames = Array.from({ length: numTxns }, (_, i) => `T${i + 1}`);
  const itemNames = Array.from({ length: numItems }, (_, i) => String.fromCharCode(65 + i)); // A, B, C...

  const ops = [];
  const activeTxnOps = {};
  txnNames.forEach(t => { activeTxnOps[t] = []; });

  let lastUsedItem = null;

  for (let i = 0; i < numOps; i++) {
    // Pick transaction
    const txn = txnNames[Math.floor(nextRand() * txnNames.length)];
    
    // Pick item (favor conflicting item based on conflictProbability)
    let item;
    if (lastUsedItem && nextRand() < conflictProbability) {
      item = lastUsedItem;
    } else {
      item = itemNames[Math.floor(nextRand() * itemNames.length)];
      lastUsedItem = item;
    }

    // Pick op type (Read or Write, with 40% Write probability)
    const type = nextRand() < 0.4 ? 'W' : 'R';
    ops.push({ txn, type, item, text: `${txn}: ${type}(${item})` });
  }

  const scheduleText = ops.map(o => o.text).join('\n');
  const compactText = ops.map(o => `${o.type}${o.txn.replace('T', '')}(${o.item})`).join(' ');
  const analysis = analyzeConflictSerializability(scheduleText);

  return {
    scheduleText,
    compactText,
    ops,
    analysis,
  };
}
