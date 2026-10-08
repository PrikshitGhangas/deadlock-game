/**
 * bankers.js — Banker's algorithm for deadlock AVOIDANCE.
 *
 *  safety algorithm      : O(n² · m)   n processes, m resource types
 *  resource-request algo : O(n² · m)   (one safety check on the tentative state)
 *
 * Every function returns a `steps` array with the same shape as the lock-based
 * simulators so the UI stepper and explanation panel work unchanged.
 */
import { explain } from './explain.js';

const leq = (a, b) => a.every((v, i) => v <= b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const clone2 = (m) => m.map((r) => r.slice());

function makeStep(steps, event, state, meta) {
  const step = {
    index: steps.length,
    event,
    op: null,
    txn: meta.pid !== undefined ? `P${meta.pid}` : null,
    state: {
      available: state.available.slice(),
      max: clone2(state.max),
      allocation: clone2(state.allocation),
      need: clone2(state.need),
      work: state.work ? state.work.slice() : null,
      finish: state.finish ? state.finish.slice() : null,
      sequence: state.sequence ? state.sequence.slice() : [],
    },
    meta,
    explanation: null,
  };
  step.explanation = explain(step);
  steps.push(step);
  return step;
}

/**
 * Safety algorithm.
 * @param {{available:number[], max:number[][], allocation:number[][]}} input
 * @returns {{safe:boolean, sequence:number[], steps:object[]}}
 */
export function isSafe(input, steps = []) {
  const n = input.max.length;
  const available = input.available.slice();
  const max = clone2(input.max);
  const allocation = clone2(input.allocation);
  const need = max.map((r, i) => sub(r, allocation[i]));
  const work = available.slice();
  const finish = Array(n).fill(false);
  const sequence = [];
  const state = { available, max, allocation, need, work, finish, sequence };

  makeStep(steps, 'BANKER_INIT', state, { work: work.slice() });

  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < n; i++) {
      if (finish[i]) continue;
      if (leq(need[i], work)) {
        const workBefore = work.slice();
        const newWork = add(work, allocation[i]);
        for (let j = 0; j < work.length; j++) work[j] = newWork[j];
        finish[i] = true;
        sequence.push(i);
        makeStep(steps, 'BANKER_STEP', state, { pid: i, need: need[i].slice(), alloc: allocation[i].slice(), workBefore, work: work.slice() });
        progress = true;
      } else {
        const failIdx = need[i].findIndex((v, j) => v > work[j]);
        makeStep(steps, 'BANKER_SKIP', state, { pid: i, need: need[i].slice(), work: work.slice(), failIdx });
      }
    }
  }
  const safe = finish.every(Boolean);
  if (safe) makeStep(steps, 'BANKER_SAFE', state, { sequence: sequence.slice() });
  else makeStep(steps, 'BANKER_UNSAFE', state, { unfinished: finish.map((f, i) => (f ? null : i)).filter((x) => x !== null) });
  return { safe, sequence, steps };
}

/**
 * Resource-request algorithm.
 * @param {{available:number[], max:number[][], allocation:number[][]}} input
 * @param {number} pid
 * @param {number[]} request
 */
export function requestResources(input, pid, request) {
  const steps = [];
  const available = input.available.slice();
  const max = clone2(input.max);
  const allocation = clone2(input.allocation);
  const need = max.map((r, i) => sub(r, allocation[i]));
  const state = { available, max, allocation, need };

  if (!leq(request, need[pid])) {
    makeStep(steps, 'BANKER_REQUEST', state, { pid, request, need: need[pid], available, verdict: 'exceeds-need' });
    return { granted: false, reason: 'exceeds-need', steps };
  }
  if (!leq(request, available)) {
    makeStep(steps, 'BANKER_REQUEST', state, { pid, request, need: need[pid], available, verdict: 'exceeds-available' });
    return { granted: false, reason: 'exceeds-available', steps };
  }
  const tent = {
    available: sub(available, request),
    max,
    allocation: allocation.map((r, i) => (i === pid ? add(r, request) : r.slice())),
  };
  const tentNeed = sub(need[pid], request);
  makeStep(steps, 'BANKER_REQUEST', state, {
    pid, request, need: need[pid], available, verdict: 'tentative',
    tentAvailable: tent.available, tentAlloc: tent.allocation[pid], tentNeed,
  });
  const safety = isSafe(tent, steps);
  const finalState = { ...tent, need: tent.max.map((r, i) => sub(r, tent.allocation[i])) };
  if (safety.safe) {
    makeStep(steps, 'BANKER_GRANT', finalState, { pid, sequence: safety.sequence });
    return { granted: true, reason: 'safe', sequence: safety.sequence, steps, state: finalState };
  }
  makeStep(steps, 'BANKER_DENY', state, { pid });
  return { granted: false, reason: 'unsafe', steps };
}

/**
 * Convenience wrapper used by the UI: run the safety check and, if a request is
 * supplied, the request algorithm too.
 */
export function simulateBankers(parsed) {
  const base = { available: parsed.available, max: parsed.max, allocation: parsed.allocation };
  const safety = isSafe(base);
  let request = null;
  let steps = safety.steps;
  if (parsed.request) {
    request = requestResources(base, parsed.request.pid, parsed.request.vector);
    steps = steps.concat(request.steps.map((s, i) => ({ ...s, index: safety.steps.length + i })));
  }
  return {
    mode: 'bankers',
    steps,
    summary: {
      steps: steps.length,
      safe: safety.safe,
      sequence: safety.sequence,
      request: request ? { pid: parsed.request.pid, vector: parsed.request.vector, granted: request.granted, reason: request.reason } : null,
    },
  };
}
