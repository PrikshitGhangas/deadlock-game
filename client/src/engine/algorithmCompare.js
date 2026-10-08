/**
 * algorithmCompare.js — Multi-Algorithm Concurrency Comparison Engine
 *
 * Runs an identical transaction workload schedule across:
 * 1. Deadlock Detection (with victim rollback)
 * 2. Deadlock Prevention (Wait-Die)
 * 3. Deadlock Prevention (Wound-Wait)
 * 4. Timestamp Ordering (Basic TO)
 * 5. Timestamp Ordering (Thomas Write Rule)
 *
 * Produces structured comparative performance metrics and analysis.
 */

import { parseSchedule } from './parser.js';
import { simulateDetection } from './detection.js';
import { simulatePrevention } from './prevention.js';
import { simulateTimestampOrdering } from './timestampOrdering.js';
import { analyzeConflictSerializability } from './precedenceGraph.js';

export function compareConcurrencyAlgorithms(scheduleText) {
  const parsed = parseSchedule(scheduleText);
  if (!parsed.ok || parsed.ops.length === 0) {
    return {
      ok: false,
      errors: parsed.errors,
      results: [],
    };
  }

  // 1. Conflict Serializability (Theoretical Baseline)
  const serializability = analyzeConflictSerializability(scheduleText);

  // 2. Deadlock Detection (Youngest victim policy)
  let detectionResult = null;
  try {
    const sim = simulateDetection(parsed.ops, parsed.txns, { victimPolicy: 'youngest' });
    const rollbacks = sim.steps.filter(s => s.type === 'VICTIM').length;
    const deadlocks = sim.summary.deadlocksDetected || 0;
    const completed = sim.steps.filter(s => s.type === 'COMMIT').length;

    detectionResult = {
      name: 'Deadlock Detection (2PL)',
      family: 'Detection',
      category: 'Pessimistic Locking',
      status: deadlocks > 0 ? `Deadlocks: ${deadlocks} resolved` : 'No deadlocks',
      aborts: rollbacks,
      totalSteps: sim.steps.length,
      completedTxns: `${completed}/${parsed.txns.length}`,
      overhead: 'Low run-time overhead until cycle check; high rollback cost if cycle occurs.',
      philosophy: 'Allow unconstrained locking; build Wait-For Graph and abort victim only when cycle forms.',
    };
  } catch (err) {
    detectionResult = { name: 'Deadlock Detection (2PL)', error: err.message, aborts: 0, totalSteps: 0 };
  }

  // 3. Wait-Die Prevention
  let waitDieResult = null;
  try {
    const sim = simulatePrevention(parsed.ops, parsed.txns, { scheme: 'wait-die' });
    const aborts = sim.steps.filter(s => s.type === 'DIE').length;
    const waits = sim.steps.filter(s => s.type === 'WAIT').length;
    const completed = sim.steps.filter(s => s.type === 'COMMIT').length;

    waitDieResult = {
      name: 'Wait-Die Prevention',
      family: 'Prevention',
      category: 'Non-Preemptive Timestamp',
      status: 'Deadlock-Free by design',
      aborts,
      totalSteps: sim.steps.length,
      completedTxns: `${completed}/${parsed.txns.length}`,
      overhead: `Moderate (${waits} waits, ${aborts} dies). Younger txns may die repeatedly.`,
      philosophy: 'Old may wait for Young; Young dies when requesting lock held by Old.',
    };
  } catch (err) {
    waitDieResult = { name: 'Wait-Die Prevention', error: err.message, aborts: 0, totalSteps: 0 };
  }

  // 4. Wound-Wait Prevention
  let woundWaitResult = null;
  try {
    const sim = simulatePrevention(parsed.ops, parsed.txns, { scheme: 'wound-wait' });
    const wounds = sim.steps.filter(s => s.type === 'WOUND').length;
    const waits = sim.steps.filter(s => s.type === 'WAIT').length;
    const completed = sim.steps.filter(s => s.type === 'COMMIT').length;

    woundWaitResult = {
      name: 'Wound-Wait Prevention',
      family: 'Prevention',
      category: 'Preemptive Timestamp',
      status: 'Deadlock-Free by design',
      aborts: wounds,
      totalSteps: sim.steps.length,
      completedTxns: `${completed}/${parsed.txns.length}`,
      overhead: `Low starvation (${wounds} wounds, ${waits} waits). Older txns preempt immediately.`,
      philosophy: 'Old wounds Young (preempts lock); Young waits for Old. Minimizes restarts.',
    };
  } catch (err) {
    woundWaitResult = { name: 'Wound-Wait Prevention', error: err.message, aborts: 0, totalSteps: 0 };
  }

  // 5. Basic Timestamp Ordering
  let basicToResult = null;
  try {
    const sim = simulateTimestampOrdering({ schedule: scheduleText, useThomasWriteRule: false });
    basicToResult = {
      name: 'Basic Timestamp Ordering',
      family: 'Ordering',
      category: 'Optimistic Timestamp Checking',
      status: sim.totalAborts > 0 ? `${sim.totalAborts} aborted` : 'All Committed',
      aborts: sim.totalAborts,
      totalSteps: sim.steps.length,
      completedTxns: `${sim.committedTxns.length}/${parsed.txns.length}`,
      overhead: 'No lock table maintained; requires tracking R_TS and W_TS per data item.',
      philosophy: 'Serializability enforced chronologically; operations arriving out-of-order are aborted.',
    };
  } catch (err) {
    basicToResult = { name: 'Basic Timestamp Ordering', error: err.message, aborts: 0, totalSteps: 0 };
  }

  // 6. Thomas Write Rule
  let twrResult = null;
  try {
    const sim = simulateTimestampOrdering({ schedule: scheduleText, useThomasWriteRule: true });
    twrResult = {
      name: 'Thomas Write Rule (TWR)',
      family: 'Ordering',
      category: 'Relaxed Timestamp Ordering',
      status: sim.totalAborts > 0 ? `${sim.totalAborts} aborted` : 'All Committed',
      aborts: sim.totalAborts,
      totalSteps: sim.steps.length,
      completedTxns: `${sim.committedTxns.length}/${parsed.txns.length}`,
      overhead: 'Fewer aborts than Basic TO by safely ignoring obsolete out-of-order writes.',
      philosophy: 'Obsolete writes are skipped rather than aborted, preserving serializability with higher throughput.',
    };
  } catch (err) {
    twrResult = { name: 'Thomas Write Rule (TWR)', error: err.message, aborts: 0, totalSteps: 0 };
  }

  const algorithms = [
    detectionResult,
    waitDieResult,
    woundWaitResult,
    basicToResult,
    twrResult,
  ].filter(Boolean);

  return {
    ok: true,
    txns: parsed.txns,
    resources: parsed.resources,
    opCount: parsed.ops.length,
    serializability,
    algorithms,
    recommendation: woundWaitResult && waitDieResult && woundWaitResult.aborts <= waitDieResult.aborts
      ? 'Wound-Wait achieved lower or equal rollbacks than Wait-Die while guaranteeing no deadlock cycles.'
      : 'Review the comparison matrix below to examine trade-offs between lock waiting and transaction restarts.',
  };
}
