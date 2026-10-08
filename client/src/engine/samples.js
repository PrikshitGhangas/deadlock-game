/**
 * samples.js — ready-made scenarios with their expected outcomes.
 * The `expected` fields are asserted by the unit tests and shown in docs/SAMPLE_IO.md.
 */

export const SAMPLES = [
  {
    id: 'classic-2',
    mode: 'detection',
    title: '1. Classic two-transaction deadlock',
    description: 'T1 locks A then wants B; T2 locks B then wants A. The textbook cycle.',
    input: {
      schedule: 'T1: LOCK-X(A)\nT2: LOCK-X(B)\nT1: LOCK-X(B)\nT2: LOCK-X(A)\nT1: COMMIT\nT2: COMMIT',
      victimPolicy: 'youngest',
    },
    expected: {
      deadlocks: 1, cycle: ['T1', 'T2', 'T1'], victim: 'T2', committed: ['T1', 'T2'],
      text: 'Deadlock detected after T2 requests A (cycle T1 → T2 → T1). T2 (youngest) is rolled back, T1 commits, T2 restarts and commits.',
    },
  },
  {
    id: 'ring-3',
    mode: 'detection',
    title: '2. Three-transaction ring',
    description: 'A → B → C → A. Each transaction holds one item and waits for the next.',
    input: {
      schedule: 'T1: UPDATE A\nT2: UPDATE B\nT3: UPDATE C\nT1: UPDATE B\nT2: UPDATE C\nT3: UPDATE A\nT1: COMMIT\nT2: COMMIT\nT3: COMMIT',
      victimPolicy: 'youngest',
    },
    expected: {
      deadlocks: 1, cycle: ['T1', 'T2', 'T3', 'T1'], victim: 'T3', committed: ['T1', 'T2', 'T3'],
      text: 'SQL-style UPDATE statements are translated to X locks. The DFS finds the 3-cycle T1 → T2 → T3 → T1 when T3 requests A. T3 is the victim.',
    },
  },
  {
    id: 'readers-ok',
    mode: 'detection',
    title: '3. Shared readers — no deadlock',
    description: 'Two readers share A; a writer waits but no cycle forms.',
    input: {
      schedule: 'T1: SELECT A\nT2: SELECT A\nT3: UPDATE A\nT1: SELECT B\nT1: COMMIT\nT2: COMMIT\nT3: UPDATE B\nT3: COMMIT',
      victimPolicy: 'youngest',
    },
    expected: {
      deadlocks: 0, committed: ['T1', 'T2', 'T3'],
      text: 'T3 blocks behind the two shared locks (edges T3 → T1, T3 → T2) but the graph is acyclic. Once T1 and T2 commit, T3 wakes up and finishes. Zero deadlocks.',
    },
  },
  {
    id: 'prevention-compare',
    mode: 'prevention',
    title: '4. Wait-die vs wound-wait',
    description: 'Same schedule as #1 under the two timestamp prevention schemes.',
    input: {
      schedule: 'T1: LOCK-X(A)\nT2: LOCK-X(B)\nT1: LOCK-X(B)\nT2: LOCK-X(A)\nT1: COMMIT\nT2: COMMIT',
      scheme: 'wait-die',
    },
    expected: {
      waitDie: { rollbacks: 1, aborted: 'T2', event: 'DIE' },
      woundWait: { rollbacks: 1, aborted: 'T2', event: 'WOUND' },
      text: 'Wait-die: T1 (older) waits for B; T2 (younger) requests A held by older T1 and DIES. Wound-wait: T1 (older) requests B held by younger T2 and WOUNDS T2 immediately — T1 never waits. In both cases no cycle ever forms.',
    },
  },
  {
    id: 'bankers-safe',
    mode: 'bankers',
    title: "5. Banker's algorithm — textbook safe state",
    description: 'Silberschatz example: 5 processes, 3 resource types.',
    input: {
      available: '3 3 2',
      max: '7 5 3\n3 2 2\n9 0 2\n2 2 2\n4 3 3',
      allocation: '0 1 0\n2 0 0\n3 0 2\n2 1 1\n0 0 2',
      request: { pid: 1, vector: '1 0 2' },
    },
    expected: {
      safe: true, sequence: [1, 3, 4, 0, 2], requestGranted: true,
      text: 'Need = Max − Allocation. Safe sequence ⟨P1, P3, P4, P0, P2⟩. Request (1,0,2) from P1 is ≤ Need and ≤ Available, and the resulting state is safe, so it is granted.',
    },
  },
  {
    id: 'bankers-unsafe',
    mode: 'bankers',
    title: "6. Banker's algorithm — request denied",
    description: 'State after P1 received (1,0,2). P0 asks for (0,2,0): fits in Available but leads to an unsafe state.',
    input: {
      available: '2 3 0',
      max: '7 5 3\n3 2 2\n9 0 2\n2 2 2\n4 3 3',
      allocation: '0 1 0\n3 0 2\n3 0 2\n2 1 1\n0 0 2',
      request: { pid: 0, vector: '0 2 0' },
    },
    expected: {
      safe: true, sequence: [1, 3, 4, 0, 2], requestGranted: false, reason: 'unsafe',
      text: 'The initial state is safe (⟨P1, P3, P4, P0, P2⟩), but tentatively granting (0,2,0) to P0 leaves Available = (2,1,0): no process has Need ≤ Work, so the Banker denies the request.',
    },
  },
  {
    id: 'upgrade-deadlock',
    mode: 'detection',
    title: '7. Lock-upgrade deadlock',
    description: 'Both transactions read A (shared) then try to write it (exclusive).',
    input: {
      schedule: 'T1: SELECT A\nT2: SELECT A\nT1: UPDATE A\nT2: UPDATE A\nT1: COMMIT\nT2: COMMIT',
      victimPolicy: 'fewestLocks',
    },
    expected: {
      deadlocks: 1, cycle: ['T1', 'T2', 'T1'], committed: ['T1', 'T2'],
      text: 'Each transaction holds S(A) and wants to upgrade to X(A), which requires the other to release its S lock. Cycle T1 → T2 → T1. This is why SELECT … FOR UPDATE exists.',
    },
  },
];

export function sampleById(id) {
  return SAMPLES.find((s) => s.id === id) || null;
}
