# Deadlock Game — Project Review Demo Guide

## 0. Objective of the demo

The project is an interactive DBMS learning system for:

1. Deadlock detection using a Wait-For Graph (WFG)
2. Deadlock prevention using Wait-Die and Wound-Wait
3. Deadlock avoidance using Banker's Algorithm
4. Interactive scheduling/game mode
5. Explanation/tutoring, history, analytics, exports and sharing

The safest review strategy is **not** to click through every feature. Demonstrate one clean deadlock from input → lock conflict → WFG → DFS cycle → victim rollback → restart, then show prevention, Banker, and one innovation.

---

# 1. Before the panel arrives

## Start the project

From the project root:

```bash
npm install
npm run dev
```

The application uses:

- React 18 + Vite for the client
- Node.js + Express for the API
- SQLite through Node's built-in `node:sqlite`
- Cytoscape.js for the WFG visualization
- Vitest + Supertest for tests

Open:

```text
http://localhost:5173
```

If the browser is already open, refresh after starting the server.

## Recommended browser preparation

Keep these tabs/screens ready:

1. Application — Detection
2. Application — Prevention
3. Application — Banker's
4. Application — Game

Do not depend on an external AI API during the review. The **offline tutor works without an API key** and is safer for a live demo.

---

# 2. Demo order

Use this order:

1. One-sentence problem statement
2. Detection — classic deadlock
3. Explain the WFG and DFS
4. Explain victim rollback and restart
5. Prevention — compare Wait-Die and Wound-Wait
6. Banker's — safe state + request decision
7. Game — demonstrate the educational innovation
8. Briefly show History/Analytics
9. Mention testing and architecture
10. Finish with limitations/future improvements

Target time: **6–10 minutes**, depending on the panel.

---

# 3. Opening explanation

Say:

> Our project is an interactive DBMS deadlock simulator and teaching tool. Instead of only showing a final answer, it models the lock manager step by step, constructs a Wait-For Graph, detects cycles using DFS, demonstrates timestamp-based prevention, demonstrates Banker's avoidance algorithm, and lets the user interact with the scheduling process through a game.

Important distinction:

> The SQLite database is used for persistence of simulations, game scores and tutor logs. The actual deadlock algorithms run in the JavaScript simulation engine.

Do NOT say that SQLite itself detects the deadlock.

---

# 4. Detection demo — the most important part

## Load sample

Open **Detection**.

Choose:

```text
1. Classic two-transaction deadlock
```

The schedule is:

```text
T1: LOCK-X(A)
T2: LOCK-X(B)
T1: LOCK-X(B)
T2: LOCK-X(A)
T1: COMMIT
T2: COMMIT
```

Victim policy:

```text
youngest
```

Click **Run simulation**.

---

# 5. Explain the first two operations

### Step 1

```text
T1: LOCK-X(A)
```

Explain:

- T1 requests an exclusive lock on A.
- No transaction currently holds A.
- Therefore the lock is granted.
- Lock table contains X(A) held by T1.
- There is no WFG edge.

### Step 2

```text
T2: LOCK-X(B)
```

Explain:

- T2 requests X(B).
- B is free.
- The request is granted.
- T1 holds A.
- T2 holds B.

At this point:

```text
A → T1
B → T2
```

There is still no waiting and therefore no deadlock.

---

# 6. Step 3 — first wait

Move to:

```text
T1: LOCK-X(B)
```

Explain:

- B is already exclusively held by T2.
- X and X are incompatible.
- T1 cannot acquire B.
- T1 enters the wait queue.
- Therefore WFG gets:

```text
T1 → T2
```

This is a **wait**, not a deadlock.

Important panel answer:

> A wait is not necessarily a deadlock. A deadlock requires a cycle in the wait-for graph.

---

# 7. Step 4 — cycle is formed

Move to:

```text
T2: LOCK-X(A)
```

Explain:

- A is held by T1.
- T2 therefore waits for T1.
- WFG now contains:

```text
T1 → T2
T2 → T1
```

This is a cycle:

```text
T1 → T2 → T1
```

Therefore the system is deadlocked.

---

# 8. Explain the DFS animation

The application animates DFS over the WFG.

Key concept:

- White = not visited
- Grey = currently being explored
- Black = completely explored

A DFS edge to a grey node represents a back edge and proves a cycle.

For this graph:

```text
T1 → T2 → T1
```

DFS eventually sees the edge:

```text
T2 → T1
```

while T1 is still active in the DFS recursion/path.

Therefore:

```text
cycle = [T1, T2, T1]
```

The implementation uses **iterative DFS**, not recursive DFS.

Complexity:

```text
O(V + E)
```

where:

- V = number of transactions
- E = wait-for relationships

---

# 9. Victim selection

The default policy is:

```text
youngest transaction
```

Timestamps are assigned according to first appearance:

```text
T1 → TS 1
T2 → TS 2
```

So T2 is younger.

The simulator chooses T2 as the victim.

Explain:

> Detection only tells us that a cycle exists. We still need a recovery action. We choose one transaction in the cycle as the victim, roll it back, release its locks, and restart it later.

The implementation supports:

- youngest
- oldest
- fewest locks
- requester/transaction that closed the cycle

Do not claim that “youngest” is the universal real-world policy. It is the selected policy for this simulation.

---

# 10. Rollback

When T2 is rolled back:

1. Its locks are released.
2. Any transactions waiting for those locks may wake up.
3. T2's executed/current/future operations are reconstructed for restart.
4. T2 is placed at the end of the remaining schedule.
5. T2 restarts.

T1 can now acquire B.

Then T1 commits.

T2 restarts and acquires:

```text
X(B)
X(A)
```

and commits.

Final result:

```text
1 deadlock
1 rollback
T1 committed
T2 committed
```

---

# 11. Important subtle point: restart timestamp

The scheduler keeps the original transaction timestamp when a transaction restarts.

This is important for timestamp prevention because otherwise a transaction could repeatedly become the youngest and suffer starvation.

Say:

> Restart does not create a new age for the transaction in the timestamp schemes. Its original timestamp is preserved.

---

# 12. Show the no-deadlock case

Load:

```text
3. Shared readers — no deadlock
```

Schedule:

```text
T1: SELECT A
T2: SELECT A
T3: UPDATE A
...
```

Explain:

- SELECT maps to S lock.
- Multiple S locks can coexist.
- UPDATE maps to X lock.
- T3 therefore waits for T1 and T2.
- WFG has edges such as:

```text
T3 → T1
T3 → T2
```

There is no path back to T3.

Therefore:

```text
wait ≠ deadlock
cycle = deadlock
```

This is a very useful panel demonstration because it proves the simulator does not simply label every blocking event as a deadlock.

---

# 13. Prevention demo

Open **Prevention**.

Use:

```text
T1: LOCK-X(A)
T2: LOCK-X(B)
T1: LOCK-X(B)
T2: LOCK-X(A)
T1: COMMIT
T2: COMMIT
```

## Wait-Die

Set:

```text
wait-die
```

Timestamps:

```text
T1 = older
T2 = younger
```

At:

```text
T1 requests B
```

B is held by younger T2.

Rule:

> Older requester may wait for younger holder.

Therefore:

```text
T1 WAIT
```

Then:

```text
T2 requests A
```

A is held by older T1.

Rule:

> Younger requester may not wait for older holder.

Therefore:

```text
T2 DIE
```

T2 is aborted and restarted.

No cycle forms.

## Wound-Wait

Now switch to:

```text
wound-wait
```

T1 is older and requests B held by younger T2.

Rule:

> Older requester wounds younger holder.

Therefore:

```text
T1 WOUNDS T2
```

T2 is aborted immediately.

T1 gets B and commits.

Key comparison:

| | Wait-Die | Wound-Wait |
|---|---|---|
| Older requests younger | Wait | Wound younger |
| Younger requests older | Die | Wait |
| Preemptive? | No | Yes |
| Goal | Prevent cycles through ordered waits | Prevent cycles through ordered waits |

Strong sentence:

> Both prevent circular wait by enforcing a monotonic timestamp direction on waits.

---

# 14. Banker's Algorithm demo

Open **Banker's**.

Use:

```text
Available:
3 3 2

Max:
7 5 3
3 2 2
9 0 2
2 2 2
4 3 3

Allocation:
0 1 0
2 0 0
3 0 2
2 1 1
0 0 2
```

The application computes:

```text
Need = Max - Allocation
```

Result:

```text
P0: 7 4 3
P1: 1 2 2
P2: 6 0 0
P3: 0 1 1
P4: 4 3 1
```

Initial:

```text
Work = Available = [3,3,2]
```

P1 can finish because:

```text
[1,2,2] <= [3,3,2]
```

Then return its allocation:

```text
Work = [5,3,2]
```

Continue until the safe sequence becomes:

```text
<P1, P3, P4, P0, P2>
```

Therefore the state is safe.

---

# 15. Explain SAFE vs UNSAFE carefully

A common panel trap:

> Does unsafe mean deadlocked?

Answer:

> No. Unsafe means the Banker cannot guarantee a completion sequence under the declared maximum demands. Deadlocked means the processes are actually unable to proceed. An unsafe state can potentially lead to deadlock, but unsafe and deadlocked are not synonymous.

---

# 16. Demonstrate a denied Banker request

Use the unsafe sample:

```text
Available:
2 3 0

Max:
7 5 3
3 2 2
9 0 2
2 2 2
4 3 3

Allocation:
0 1 0
3 0 2
3 0 2
2 1 1
0 0 2

Request:
P0 → 0 2 0
```

Important point:

The request is within Available, but granting it leaves:

```text
Work = [2,1,0]
```

and no process has:

```text
Need <= Work
```

So the tentative state is unsafe.

The Banker denies the request.

This is the best example for proving that:

> request ≤ Available is necessary, but not sufficient.

---

# 17. Game demo

Open **Game**.

Choose an easy level.

Explain:

> Instead of the engine deciding the entire schedule automatically, the student becomes the scheduler.

Each transaction card shows its next operation.

A bad ordering can create:

```text
T1 → T2 → T1
```

and immediately ends the level.

A safe ordering allows every transaction to commit.

## Hint system

The hint system does more than check the immediate next operation.

It recursively explores reachable states and memoizes states.

Conceptually:

```text
current state
   ↓
try every legal transaction
   ↓
simulate each move
   ↓
ask whether the resulting state is winnable
   ↓
memoize state
```

Because game levels are intentionally small, exhaustive search is practical.

Complexity is exponential in the worst case, so this should NOT be described as a scalable general scheduling algorithm.

---

# 18. Tutor demo

On Detection, after running a schedule, ask:

```text
Why did T2 get rolled back?
```

The offline tutor derives the answer from the actual simulation.

Then ask:

```text
What if I used wound-wait instead?
```

The tutor re-runs the schedule under the alternative strategy.

Important implementation detail:

The offline tutor is not a general LLM. It uses:

```text
question normalization
→ entity extraction
→ intent matching
→ deterministic resolver
→ simulation data
```

The optional AI tutor is separate.

---

# 19. History / analytics demo

Run a simulation and click:

```text
Save to history
```

Open **History**.

Show:

- saved runs
- number of steps
- deadlock counts
- analytics
- game score statistics
- tutor question statistics
- Markdown export
- JSON export

Explain:

> The server provides persistence and analytics. The simulation itself remains deterministic and can run independently of the database.

---

# 20. Architecture explanation

If asked how the system works end-to-end:

```text
User input
   ↓
React UI
   ↓
Parser / validation
   ↓
Simulation engine
   ├── LockManager
   ├── WFG
   ├── DFS
   ├── Detection
   ├── Prevention
   ├── Banker's
   └── Game
   ↓
Step snapshots
   ↓
React visualization
   ├── Cytoscape graph
   ├── Lock table
   ├── Timeline
   └── Explanation
```

Persistence path:

```text
React
  ↓ HTTP /api
Express
  ↓
SQLite
```

The optional AI path is:

```text
React
  ↓ /api/ai/ask
Express
  ↓
configured LLM provider
```

The API key stays on the server.

---

# 21. If the panel asks "Why JavaScript?"

Answer:

> The project is an interactive browser application, so JavaScript lets us use the same language for the simulation engine and the React UI. The engine is intentionally dependency-free and deterministic, which also makes it easy to unit-test.

---

# 22. If the panel asks "Why not directly use a DBMS?"

Answer:

> The educational objective is to expose the internal algorithmic state. A real DBMS normally hides its lock manager, wait-for graph and victim-selection internals. Implementing the engine ourselves lets the student inspect every transition and compare strategies on exactly the same schedule.

---

# 23. If something breaks during the live demo

Do not panic or improvise.

Use the built-in sample.

If the server is unavailable:

1. Refresh
2. Confirm `npm run dev`
3. Check `http://localhost:5173`
4. Do not enable the optional AI tutor
5. Continue with the client-side simulation features

The core detection/prevention/Banker's engines are client-side and do not require the AI provider.

---

# 24. Final closing statement

Use:

> The main contribution is not just detecting a deadlock. The project makes the complete DBMS concept observable: lock acquisition, blocking, wait-for graph construction, cycle detection, recovery, prevention, avoidance, and scheduling decisions. The same deterministic engine feeds the visualizations, explanations, tutor and game, while the backend provides persistence and analytics.

