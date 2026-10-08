/**
 * timestampOrdering.js — Timestamp Ordering Concurrency Protocol Simulator
 *
 * Implements:
 * 1. Basic Timestamp Ordering (Basic TO) Protocol.
 * 2. Thomas Write Rule (TWR) optimization for obsolete writes.
 * 3. Step-by-step state tracking of R_TS(X) and W_TS(X) per data item.
 * 4. Detailed educational explanations for ALLOW, ABORT, and IGNORE decisions.
 */

import { parseScheduleOperations } from './precedenceGraph.js';

export const SAMPLE_TO_SCHEDULES = {
  serializable: [
    'T1: R(A)',
    'T1: W(A)',
    'T2: R(A)',
    'T2: W(B)',
  ].join('\n'),

  aborted_read: [
    'T1: R(A)',
    'T2: W(A)',
    'T1: R(A)', // T1 tries to read after T2 already overwrote it -> Abort T1
  ].join('\n'),

  thomas_write: [
    'T1: R(A)',
    'T2: W(A)',
    'T1: W(A)', // Basic TO aborts; Thomas Write Rule ignores write!
  ].join('\n'),
};

/**
 * Simulates a schedule under Timestamp Ordering Protocol.
 *
 * @param {Object} options
 * @param {string|Array} options.schedule
 * @param {Object} [options.timestamps] - manual map { T1: 10, T2: 20 } or auto-assigned based on arrival
 * @param {boolean} [options.useThomasWriteRule=false]
 */
export function simulateTimestampOrdering({
  schedule,
  timestamps = null,
  useThomasWriteRule = false,
} = {}) {
  const ops = parseScheduleOperations(schedule);
  const txns = Array.from(new Set(ops.map(o => o.txn))).sort();
  const items = Array.from(new Set(ops.map(o => o.item))).sort();

  // Assign transaction timestamps if not provided (e.g. T1 -> 10, T2 -> 20, ...)
  const txnTimestamps = {};
  txns.forEach((t, idx) => {
    txnTimestamps[t] = (timestamps && timestamps[t] !== undefined)
      ? Number(timestamps[t])
      : (idx + 1) * 10;
  });

  // Track R_TS and W_TS for all items (initialized to 0)
  const itemTimestamps = {};
  items.forEach(it => {
    itemTimestamps[it] = { rTS: 0, wTS: 0 };
  });

  const abortedTxns = new Set();
  const steps = [];

  for (let stepIndex = 0; stepIndex < ops.length; stepIndex++) {
    const op = ops[stepIndex];
    const { txn, type, item } = op;
    const ts = txnTimestamps[txn];

    // If transaction was already aborted in earlier step, its subsequent ops are skipped
    if (abortedTxns.has(txn)) {
      steps.push({
        stepIndex: stepIndex + 1,
        op,
        txn,
        ts,
        item,
        type,
        decision: 'SKIPPED',
        explanation: `${txn} was previously aborted; operation skipped.`,
        itemState: JSON.parse(JSON.stringify(itemTimestamps)),
        abortedTxns: Array.from(abortedTxns),
      });
      continue;
    }

    const currentItemState = itemTimestamps[item] || { rTS: 0, wTS: 0 };
    const { rTS, wTS } = currentItemState;

    if (type === 'R') {
      // Read Check: TS(T) < W_TS(X) ?
      if (ts < wTS) {
        // Violates condition: item was already overwritten by younger transaction
        abortedTxns.add(txn);
        steps.push({
          stepIndex: stepIndex + 1,
          op,
          txn,
          ts,
          item,
          type,
          decision: 'ABORT',
          explanation: `REJECT & ABORT: TS(${txn})=${ts} < W_TS(${item})=${wTS}. Transaction tried to read a value of ${item} that was already overwritten by a younger transaction.`,
          itemState: JSON.parse(JSON.stringify(itemTimestamps)),
          abortedTxns: Array.from(abortedTxns),
        });
      } else {
        // Read Allowed
        const newRTS = Math.max(rTS, ts);
        itemTimestamps[item].rTS = newRTS;
        steps.push({
          stepIndex: stepIndex + 1,
          op,
          txn,
          ts,
          item,
          type,
          decision: 'ALLOW',
          explanation: `READ ALLOWED: TS(${txn})=${ts} >= W_TS(${item})=${wTS}. Updated R_TS(${item}) to max(${rTS}, ${ts}) = ${newRTS}.`,
          itemState: JSON.parse(JSON.stringify(itemTimestamps)),
          abortedTxns: Array.from(abortedTxns),
        });
      }
    } else if (type === 'W') {
      // Write Check 1: TS(T) < R_TS(X) ?
      if (ts < rTS) {
        abortedTxns.add(txn);
        steps.push({
          stepIndex: stepIndex + 1,
          op,
          txn,
          ts,
          item,
          type,
          decision: 'ABORT',
          explanation: `REJECT & ABORT: TS(${txn})=${ts} < R_TS(${item})=${rTS}. A younger transaction has already read the older value; write arrives too late.`,
          itemState: JSON.parse(JSON.stringify(itemTimestamps)),
          abortedTxns: Array.from(abortedTxns),
        });
      } else if (ts < wTS) {
        // Write Check 2: TS(T) < W_TS(X) ?
        if (useThomasWriteRule) {
          // Thomas Write Rule: Obsolete write is safely ignored!
          steps.push({
            stepIndex: stepIndex + 1,
            op,
            txn,
            ts,
            item,
            type,
            decision: 'IGNORE',
            explanation: `THOMAS WRITE RULE APPLIED: TS(${txn})=${ts} < W_TS(${item})=${wTS}. Outdated write is obsolete and ignored without aborting ${txn}. Serializability is preserved!`,
            itemState: JSON.parse(JSON.stringify(itemTimestamps)),
            abortedTxns: Array.from(abortedTxns),
          });
        } else {
          // Basic TO: Abort
          abortedTxns.add(txn);
          steps.push({
            stepIndex: stepIndex + 1,
            op,
            txn,
            ts,
            item,
            type,
            decision: 'ABORT',
            explanation: `REJECT & ABORT (Basic TO): TS(${txn})=${ts} < W_TS(${item})=${wTS}. Transaction tried to overwrite a newer value written by a younger transaction.`,
            itemState: JSON.parse(JSON.stringify(itemTimestamps)),
            abortedTxns: Array.from(abortedTxns),
          });
        }
      } else {
        // Write Allowed
        const newWTS = Math.max(wTS, ts);
        itemTimestamps[item].wTS = newWTS;
        steps.push({
          stepIndex: stepIndex + 1,
          op,
          txn,
          ts,
          item,
          type,
          decision: 'ALLOW',
          explanation: `WRITE ALLOWED: TS(${txn})=${ts} >= R_TS(${item}) and W_TS(${item}). Updated W_TS(${item}) = ${newWTS}.`,
          itemState: JSON.parse(JSON.stringify(itemTimestamps)),
          abortedTxns: Array.from(abortedTxns),
        });
      }
    }
  }

  const totalAborts = abortedTxns.size;
  const committedTxns = txns.filter(t => !abortedTxns.has(t));

  return {
    txns,
    items,
    txnTimestamps,
    finalItemTimestamps: itemTimestamps,
    steps,
    abortedTxns: Array.from(abortedTxns),
    committedTxns,
    totalAborts,
    useThomasWriteRule,
    summary: totalAborts === 0
      ? `All ${txns.length} transactions completed successfully without any rollbacks.`
      : `${totalAborts} transaction(s) aborted due to timestamp ordering conflicts (${Array.from(abortedTxns).join(', ')}).`,
  };
}
