/**
 * explain.js — rule-based, human-readable explanations for every simulation event.
 * Each function receives the step (already populated with state) and returns
 * { title, text, why } where `why` is a one-line "why it matters" for students.
 */

const modeName = (m) => (m === 'X' ? 'exclusive (X)' : 'shared (S)');
const list = (arr) => (arr.length ? arr.join(', ') : 'none');

function grantsText(grants) {
  if (!grants || grants.length === 0) return '';
  return ' This wakes up ' + grants.map((g) => `${g.txn} (granted ${g.mode} on ${g.res})`).join(', ') + '.';
}

const EXPLAINERS = {
  GRANT(step) {
    const { op } = step;
    const cur = step.meta?.upgrade ? ` upgrading its shared lock to exclusive` : '';
    const sql = op.sql ? ` (${op.sql} ${op.res} needs a ${op.mode} lock)` : '';
    return {
      title: `${op.txn} acquires ${modeName(op.mode)} lock on ${op.res}`,
      text: `${op.txn} requested a ${modeName(op.mode)} lock on ${op.res}${sql}${cur}. No other transaction holds a conflicting lock, so the lock manager grants it immediately. ${op.txn} now holds: ${list(step.meta.holds)}.`,
      why: op.mode === 'X'
        ? 'Exclusive locks are needed to write; nobody else can read or write the item until it is released.'
        : 'Shared locks let many readers coexist, but block writers.',
    };
  },
  BLOCK(step) {
    const { op } = step;
    const by = step.meta.blockedBy.map((b) => `${b.txn} (${b.mode})`).join(', ');
    const edges = step.meta.blockedBy.map((b) => `${op.txn} → ${b.txn}`).join(', ');
    const cyc = step.cycle ? ' The DFS found a cycle — see the next step.' : ' The DFS finds no cycle, so this is an ordinary wait, not a deadlock.';
    return {
      title: `${op.txn} blocks waiting for ${op.res}`,
      text: `${op.txn} wants a ${modeName(op.mode)} lock on ${op.res}, but it is held by ${by} in a conflicting mode. ${op.txn} is put in the wait queue. Edge${step.meta.blockedBy.length > 1 ? 's' : ''} ${edges} added to the wait-for graph and a cycle check runs.${cyc}`,
      why: 'Every wait adds an edge to the wait-for graph. Deadlock detection is simply cycle detection on this graph.',
    };
  },
  UNLOCK(step) {
    const { op } = step;
    return {
      title: `${op.txn} releases ${op.res}`,
      text: `${op.txn} releases its lock on ${op.res}.${grantsText(step.granted) || ' No one was waiting for it.'}`,
      why: 'Releasing locks early reduces waiting — but under strict two-phase locking, locks are only released at commit.',
    };
  },
  COMMIT(step) {
    const { op } = step;
    const rel = step.meta.released.map((r) => `${r.mode}(${r.res})`);
    return {
      title: `${op.txn} commits`,
      text: `${op.txn} commits and releases all its locks: ${list(rel)}.${grantsText(step.granted)}`,
      why: 'Commit is the point where a transaction\'s effects become permanent and its locks are released (strict 2PL).',
    };
  },
  ABORT(step) {
    const { op } = step;
    const rel = step.meta.released.map((r) => `${r.mode}(${r.res})`);
    return {
      title: `${op.txn} aborts`,
      text: `${op.txn} aborts voluntarily, undoing its work and releasing ${list(rel)}.${grantsText(step.granted)}`,
      why: 'An abort rolls back all changes; the released locks may unblock other transactions.',
    };
  },
  DEADLOCK_DETECTED(step) {
    const cyc = step.cycle.join(' → ');
    return {
      title: `Deadlock detected: ${cyc}`,
      text: `The depth-first search over the wait-for graph found the cycle ${cyc}. Each transaction in the cycle is waiting for a lock held by the next one, so none of them can ever proceed on their own. This is a deadlock; the system must abort one of them.`,
      why: 'A cycle in the wait-for graph is a necessary and sufficient condition for deadlock under lock-based protocols.',
    };
  },
  VICTIM(step) {
    return {
      title: `${step.txn} chosen as victim (${step.meta.policyLabel})`,
      text: `${step.txn} is selected for rollback using the "${step.meta.policyLabel}" policy: ${step.meta.reason}. Rolling it back releases ${list(step.meta.released.map((r) => `${r.mode}(${r.res})`))}.${grantsText(step.granted)} ${step.txn} will restart from its first operation after the other transactions.`,
      why: 'Victim selection tries to minimise the cost of rollback (work lost, locks held, number of rollbacks so far) while breaking the cycle.',
    };
  },
  RESTART(step) {
    return {
      title: `${step.txn} restarts`,
      text: `${step.txn} begins again from its first operation${step.meta.keepTimestamp ? ' with its original timestamp, so it is not starved' : ''}.`,
      why: 'Restarted transactions keep their old timestamp in wait-die / wound-wait so they eventually become the oldest and win.',
    };
  },
  WAIT(step) {
    const { op } = step;
    const d = step.meta;
    return {
      title: `${op.txn} waits for ${d.holder} (${d.scheme})`,
      text: `${op.txn} (TS=${d.tsReq}) wants ${op.res}, held by ${d.holder} (TS=${d.tsHolder}). Under ${d.scheme}: ${d.rule}. Therefore ${op.txn} waits.`,
      why: d.scheme === 'wait-die'
        ? 'Wait-die: older transactions may wait for younger ones — waits only go from old to young, so no cycle can form.'
        : 'Wound-wait: younger transactions wait for older ones — waits only go from young to old, so no cycle can form.',
    };
  },
  DIE(step) {
    const { op } = step;
    const d = step.meta;
    return {
      title: `${op.txn} dies (wait-die)`,
      text: `${op.txn} (TS=${d.tsReq}) wants ${op.res}, held by older ${d.holder} (TS=${d.tsHolder}). Under wait-die a younger transaction may not wait for an older one, so ${op.txn} is aborted ("dies") and will restart later with the same timestamp.${grantsText(step.granted)}`,
      why: 'Non-preemptive: the requester gives up instead of preempting the holder. Simple, but may cause unnecessary rollbacks.',
    };
  },
  WOUND(step) {
    const { op } = step;
    const d = step.meta;
    return {
      title: `${op.txn} wounds ${d.victim} (wound-wait)`,
      text: `${op.txn} (TS=${d.tsReq}) wants ${op.res}, held by younger ${d.victim} (TS=${d.tsHolder}). Under wound-wait an older transaction preempts a younger one: ${d.victim} is aborted ("wounded") and its locks are released so ${op.txn} can proceed.${grantsText(step.granted)}`,
      why: 'Preemptive: the older transaction never waits for a younger one, which keeps the number of rollbacks lower than wait-die in practice.',
    };
  },
  END(step) {
    return {
      title: step.meta.stuck ? 'Simulation ends with transactions still waiting' : 'Schedule complete',
      text: step.meta.stuck
        ? `No more operations can run. ${list(step.meta.stuck)} are still waiting for locks held by transactions that never commit in this schedule. This is not a deadlock (no cycle) — add COMMIT/UNLOCK operations to release the locks.`
        : `All operations have executed. Committed: ${list(step.committed)}. Deadlocks detected: ${step.meta.deadlocks}. Rollbacks: ${step.meta.rollbacks}.`,
      why: 'A schedule with no cycle in its wait-for graph at any point is deadlock-free.',
    };
  },
  // Banker's algorithm
  BANKER_INIT(step) {
    return {
      title: 'Compute Need = Max − Allocation',
      text: `For each process, Need[i] = Max[i] − Allocation[i] is the maximum it may still request. Work starts as Available = [${step.meta.work.join(', ')}] and Finish[i] = false for every process.`,
      why: 'The safety algorithm simulates granting each process its worst-case remaining demand to see whether everyone can finish.',
    };
  },
  BANKER_STEP(step) {
    const m = step.meta;
    return {
      title: `P${m.pid} can finish (Need ≤ Work)`,
      text: `Need[P${m.pid}] = [${m.need.join(', ')}] ≤ Work = [${m.workBefore.join(', ')}], so P${m.pid} could run to completion and return its allocation [${m.alloc.join(', ')}]. Work becomes [${m.work.join(', ')}]; Finish[P${m.pid}] = true.`,
      why: 'Finding a process whose remaining need fits in the currently free resources means it cannot be part of a deadlock.',
    };
  },
  BANKER_SKIP(step) {
    const m = step.meta;
    return {
      title: `P${m.pid} must wait (Need > Work)`,
      text: `Need[P${m.pid}] = [${m.need.join(', ')}] is not ≤ Work = [${m.work.join(', ')}] (fails on R${m.failIdx}). Skip it for now and try the other unfinished processes.`,
      why: 'A process that cannot finish now might still finish later once others release resources.',
    };
  },
  BANKER_SAFE(step) {
    return {
      title: `System is SAFE — sequence ⟨${step.meta.sequence.map((p) => 'P' + p).join(', ')}⟩`,
      text: `Every process reached Finish = true, so there exists an order in which all processes can complete even if each demands its full Max. The safe sequence is ⟨${step.meta.sequence.map((p) => 'P' + p).join(', ')}⟩.`,
      why: 'A safe state guarantees deadlock cannot occur; the Banker only grants requests that keep the system safe.',
    };
  },
  BANKER_UNSAFE(step) {
    return {
      title: 'System is UNSAFE',
      text: `No unfinished process has Need ≤ Work. ${step.meta.unfinished.map((p) => 'P' + p).join(', ')} can never be guaranteed to finish. The state is unsafe — a deadlock is possible (though not certain).`,
      why: 'Unsafe ≠ deadlocked. It means the Banker cannot prove all processes will finish, so it refuses to enter this state.',
    };
  },
  BANKER_REQUEST(step) {
    const m = step.meta;
    return {
      title: `P${m.pid} requests [${m.request.join(', ')}]`,
      text: m.verdict === 'exceeds-need'
        ? `Request [${m.request.join(', ')}] exceeds P${m.pid}'s remaining Need [${m.need.join(', ')}]. This violates its declared maximum — the request is an error and is rejected.`
        : m.verdict === 'exceeds-available'
          ? `Request [${m.request.join(', ')}] is within Need but exceeds Available [${m.available.join(', ')}]. P${m.pid} must wait until more resources are free.`
          : `Request [${m.request.join(', ')}] is within Need and within Available. Tentatively grant it: Available = [${m.tentAvailable.join(', ')}], Allocation[P${m.pid}] = [${m.tentAlloc.join(', ')}], Need[P${m.pid}] = [${m.tentNeed.join(', ')}]. Now run the safety algorithm on this tentative state.`,
      why: 'The resource-request algorithm checks (1) request ≤ need, (2) request ≤ available, then (3) the resulting state is safe.',
    };
  },
  BANKER_GRANT(step) {
    return {
      title: `Request GRANTED to P${step.meta.pid}`,
      text: `The tentative state is safe (sequence ⟨${step.meta.sequence.map((p) => 'P' + p).join(', ')}⟩), so the request is granted and the allocation becomes permanent.`,
      why: 'Granting only safe-state-preserving requests is how the Banker avoids deadlock entirely.',
    };
  },
  BANKER_DENY(step) {
    return {
      title: `Request DENIED to P${step.meta.pid}`,
      text: `Granting the request would leave the system in an unsafe state, so the Banker refuses. The allocation is rolled back and P${step.meta.pid} must wait.`,
      why: 'Denying a request that fits in Available may look wasteful, but it is what prevents a future deadlock.',
    };
  },
  // Game
  GAME_MOVE(step) {
    return {
      title: step.meta.title,
      text: step.meta.text,
      why: step.meta.why,
    };
  },
};

/**
 * @param {object} step
 * @returns {{title:string, text:string, why:string}}
 */
export function explain(step) {
  const fn = EXPLAINERS[step.event];
  if (!fn) return { title: step.event, text: '', why: '' };
  return fn(step);
}

export const VICTIM_POLICIES = {
  youngest: { label: 'youngest transaction', describe: (t) => `${t} started last, so it has done the least work` },
  oldest: { label: 'oldest transaction', describe: (t) => `${t} started first (rarely used — shown for comparison)` },
  fewestLocks: { label: 'fewest locks held', describe: (t, n) => `${t} holds only ${n} lock${n === 1 ? '' : 's'}, so rolling it back frees the least state` },
  requester: { label: 'transaction that closed the cycle', describe: (t) => `${t} made the request that completed the cycle` },
};
