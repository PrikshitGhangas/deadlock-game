/**
 * parser.js — turns user text into a validated list of operations.
 *
 * Accepted line formats (case-insensitive, one op per line, `#` or `--` comments):
 *   T1: LOCK-X(A)      T1: X(A)        T1: UPDATE A     T1: WRITE A
 *   T1: LOCK-S(B)      T1: S(B)        T1: SELECT B     T1: READ B
 *   T1: UNLOCK(A)      T1: U(A)
 *   T1: COMMIT         T1: ABORT
 *
 * @typedef {Object} Op
 * @property {number} line      1-based source line
 * @property {string} txn       transaction id, e.g. "T1"
 * @property {'LOCK'|'UNLOCK'|'COMMIT'|'ABORT'} type
 * @property {'S'|'X'=} mode    lock mode for LOCK ops
 * @property {string=} res      resource name for LOCK / UNLOCK ops
 * @property {string} text      canonical rendering, e.g. "T1: LOCK-X(A)"
 */

export const MAX_TXNS = 12;
export const MAX_RESOURCES = 12;

const LINE_RE = /^\s*(T\d+|[A-Za-z]\w*)\s*:\s*(.+?)\s*$/i;
const LOCK_RE = /^(?:LOCK-?([SX])|([SX]))\s*\(\s*([A-Za-z_]\w*)\s*\)$/i;
const SQL_RE = /^(SELECT|READ|UPDATE|WRITE|INSERT|DELETE)\s+([A-Za-z_]\w*)$/i;
const UNLOCK_RE = /^(?:UNLOCK|U)\s*\(\s*([A-Za-z_]\w*)\s*\)$/i;

/** Canonical text for an op. */
export function opToText(op) {
  switch (op.type) {
    case 'LOCK':
      return `${op.txn}: LOCK-${op.mode}(${op.res})`;
    case 'UNLOCK':
      return `${op.txn}: UNLOCK(${op.res})`;
    default:
      return `${op.txn}: ${op.type}`;
  }
}

/**
 * Parse a schedule.
 * @param {string} text
 * @returns {{ok: boolean, ops: Op[], errors: {line:number, msg:string}[], txns: string[], resources: string[]}}
 */
export function parseSchedule(text) {
  const errors = [];
  const ops = [];
  const lines = String(text ?? '').split(/\r?\n/);
  const txns = [];
  const resources = [];
  const committed = new Set();
  /** @type {Map<string, Map<string,'S'|'X'>>} txn -> res -> mode (static check only) */
  const held = new Map();

  lines.forEach((raw, i) => {
    const line = i + 1;
    const src = raw.replace(/(#|--).*$/, '').trim();
    if (!src) return;

    const m = LINE_RE.exec(src);
    if (!m) {
      errors.push({ line, msg: `Cannot parse "${src}". Expected "T1: LOCK-X(A)", "T1: SELECT A", "T1: UNLOCK(A)" or "T1: COMMIT".` });
      return;
    }
    const txn = m[1].toUpperCase();
    const body = m[2].trim();
    const upper = body.toUpperCase();

    if (!txns.includes(txn)) txns.push(txn);
    if (committed.has(txn)) {
      errors.push({ line, msg: `${txn} already committed/aborted — no operations allowed after COMMIT/ABORT.` });
      return;
    }
    if (!held.has(txn)) held.set(txn, new Map());
    const mine = held.get(txn);

    let op = null;
    let lm;
    if ((lm = LOCK_RE.exec(body))) {
      const mode = (lm[1] || lm[2]).toUpperCase();
      op = { line, txn, type: 'LOCK', mode, res: lm[3].toUpperCase() };
    } else if ((lm = SQL_RE.exec(body))) {
      const verb = lm[1].toUpperCase();
      const mode = verb === 'SELECT' || verb === 'READ' ? 'S' : 'X';
      op = { line, txn, type: 'LOCK', mode, res: lm[2].toUpperCase(), sql: verb };
    } else if ((lm = UNLOCK_RE.exec(body))) {
      op = { line, txn, type: 'UNLOCK', res: lm[1].toUpperCase() };
    } else if (upper === 'COMMIT' || upper === 'ABORT') {
      op = { line, txn, type: upper };
    } else {
      errors.push({ line, msg: `Unknown operation "${body}" for ${txn}.` });
      return;
    }

    if (op.type === 'LOCK') {
      if (!resources.includes(op.res)) resources.push(op.res);
      const cur = mine.get(op.res);
      if (cur === 'X' || (cur === 'S' && op.mode === 'S')) {
        errors.push({ line, msg: `${txn} already holds ${cur} lock on ${op.res}; the request is redundant.` });
        return;
      }
      mine.set(op.res, op.mode);
    } else if (op.type === 'UNLOCK') {
      if (!mine.has(op.res)) {
        errors.push({ line, msg: `${txn} cannot UNLOCK(${op.res}) — it never requested a lock on ${op.res}.` });
        return;
      }
      mine.delete(op.res);
    } else {
      committed.add(txn);
    }
    op.text = opToText(op);
    ops.push(op);
  });

  if (ops.length === 0 && errors.length === 0) {
    errors.push({ line: 0, msg: 'Schedule is empty. Enter at least one operation.' });
  }
  if (txns.length > MAX_TXNS) {
    errors.push({ line: 0, msg: `Too many transactions (${txns.length}). Maximum is ${MAX_TXNS} to keep the graph readable.` });
  }
  if (resources.length > MAX_RESOURCES) {
    errors.push({ line: 0, msg: `Too many resources (${resources.length}). Maximum is ${MAX_RESOURCES}.` });
  }

  return { ok: errors.length === 0, ops, errors, txns, resources };
}

/**
 * Parse Banker's algorithm matrices.
 * @param {{available: (number[]|string), max: (number[][]|string), allocation: (number[][]|string), request?: {pid:number, vector:number[]|string}}} input
 */
export function parseBankers(input) {
  const errors = [];
  const toVec = (v, label) => {
    if (Array.isArray(v)) return v.map(Number);
    const parts = String(v ?? '').trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length === 0) errors.push({ line: 0, msg: `${label} is empty.` });
    return parts.map(Number);
  };
  const toMat = (m, label) => {
    if (Array.isArray(m)) return m.map((r) => r.map(Number));
    const rows = String(m ?? '').split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    if (rows.length === 0) errors.push({ line: 0, msg: `${label} matrix is empty.` });
    return rows.map((r) => r.split(/[\s,]+/).filter(Boolean).map(Number));
  };

  const available = toVec(input.available, 'Available');
  const max = toMat(input.max, 'Max');
  const allocation = toMat(input.allocation, 'Allocation');
  const m = available.length;
  const n = max.length;

  const bad = (arr) => arr.some((x) => !Number.isInteger(x) || x < 0);
  if (bad(available)) errors.push({ line: 0, msg: 'Available must contain non-negative integers.' });
  max.forEach((r, i) => { if (bad(r)) errors.push({ line: i + 1, msg: `Max row ${i} must contain non-negative integers.` }); });
  allocation.forEach((r, i) => { if (bad(r)) errors.push({ line: i + 1, msg: `Allocation row ${i} must contain non-negative integers.` }); });

  if (allocation.length !== n) errors.push({ line: 0, msg: `Allocation has ${allocation.length} rows but Max has ${n}. They must describe the same processes.` });
  max.forEach((r, i) => { if (r.length !== m) errors.push({ line: i + 1, msg: `Max row ${i} has ${r.length} values; expected ${m} (one per resource type).` }); });
  allocation.forEach((r, i) => { if (r.length !== m) errors.push({ line: i + 1, msg: `Allocation row ${i} has ${r.length} values; expected ${m}.` }); });
  if (n > 10 || m > 6) errors.push({ line: 0, msg: 'Keep it to at most 10 processes and 6 resource types.' });

  let need = [];
  if (errors.length === 0) {
    need = max.map((r, i) => r.map((v, j) => v - allocation[i][j]));
    need.forEach((r, i) => r.forEach((v, j) => {
      if (v < 0) errors.push({ line: i + 1, msg: `P${i} allocation of R${j} (${allocation[i][j]}) exceeds its Max (${max[i][j]}).` });
    }));
  }

  let request = null;
  if (input.request && (input.request.vector !== undefined && input.request.vector !== '')) {
    const pid = Number(input.request.pid);
    const vector = toVec(input.request.vector, 'Request');
    if (!Number.isInteger(pid) || pid < 0 || pid >= n) errors.push({ line: 0, msg: `Request process P${input.request.pid} does not exist.` });
    else if (vector.length !== m || bad(vector)) errors.push({ line: 0, msg: `Request vector must have ${m} non-negative integers.` });
    else request = { pid, vector };
  }

  return { ok: errors.length === 0, errors, available, max, allocation, need, request, n, m };
}
