# Member 1 — DBMS Core Engine & Algorithms

## Assigned part

Present and defend:

- DBMS problem
- locks and 2PL
- parser
- lock manager
- Wait-For Graph
- DFS cycle detection
- deadlock detection
- victim selection
- rollback/restart
- complexity and correctness

You must also understand the rest of the system at architecture level.

---

# 1. Project problem

A DBMS executes transactions concurrently to improve throughput.

Concurrency introduces lock conflicts.

Example:

```text
T1 holds A and wants B
T2 holds B and wants A
```

Neither can continue.

This is a deadlock.

The project turns this hidden DBMS behavior into an interactive simulation.

---

# 2. Shared and Exclusive locks

## Shared lock S

Used for reading.

Multiple transactions may hold S on the same item.

```text
S + S = compatible
```

## Exclusive lock X

Used for writing.

Only one transaction can hold it.

```text
S + X = conflict
X + S = conflict
X + X = conflict
```

Compatibility matrix:

```text
       S    X
S      ✓    ✗
X      ✗    ✗
```

---

# 3. 2PL

Two-Phase Locking has:

### Growing phase

Acquire locks.

### Shrinking phase

Release locks.

It guarantees conflict serializability, but:

> 2PL does NOT guarantee freedom from deadlock.

Strict 2PL keeps write locks until commit; the simulator's commit behavior releases all held locks.

---

# 4. Parser

File:

```text
client/src/engine/parser.js
```

The parser accepts:

```text
T1: LOCK-X(A)
T1: LOCK-S(B)
T1: UNLOCK(A)
T1: COMMIT
```

It also accepts SQL-style shorthand:

```text
T1: SELECT A
T1: READ A
```

→ S lock

and:

```text
T1: UPDATE A
T1: WRITE A
T1: INSERT A
T1: DELETE A
```

→ X lock

The parser validates:

- syntax
- transaction names
- resources
- duplicate/redundant locks
- invalid unlocks
- operations after commit/abort
- maximum transactions
- maximum resources

This prevents the simulation engine from operating on malformed input.

---

# 5. LockManager

File:

```text
client/src/engine/lockManager.js
```

Internal structure:

```text
resource
 ├── holders
 │    ├── T1: X
 │    └── T2: S
 └── queue
      ├── T3: X
      └── T4: S
```

Important methods:

```text
request()
conflicts()
processQueue()
release()
releaseAll()
holdsOf()
waitingRequest()
waitsFor()
snapshot()
clone()
```

---

# 6. How a lock request works

Suppose:

```text
T1 requests X(A)
```

The manager:

1. Looks up A.
2. Checks current holders.
3. Ignores T1 itself.
4. Tests compatibility.
5. If no conflict → grant.
6. If conflict → enqueue.
7. Returns the conflicting holders.

The conflicting holders become the basis for WFG edges.

---

# 7. Lock upgrades

Example:

```text
T1: SELECT A
T2: SELECT A
T1: UPDATE A
T2: UPDATE A
```

First:

```text
T1 holds S(A)
T2 holds S(A)
```

Then T1 wants X(A).

T1 must wait for T2.

Then T2 wants X(A).

T2 must wait for T1.

WFG:

```text
T1 → T2
T2 → T1
```

This is a deadlock.

The LockManager explicitly recognizes S→X upgrades.

---

# 8. Wait-For Graph

File:

```text
client/src/engine/waitForGraph.js
```

Definition:

```text
node = transaction
edge Ti → Tj = Ti is waiting for a lock held by Tj
```

Example:

```text
T1 holds A
T2 holds B
T1 waits for B
T2 waits for A
```

Graph:

```text
T1 → T2
T2 → T1
```

Cycle means deadlock.

---

# 9. WFG construction

The engine:

1. Gets all transactions.
2. Checks which transactions are waiting.
3. Gets the resource of each waiting request.
4. Finds conflicting holders.
5. Adds an edge from waiter to holder.

If T3 waits for A and A is held by T1 and T2:

```text
T3 → T1
T3 → T2
```

This is why the graph can contain multiple outgoing edges.

---

# 10. Why a cycle is sufficient

Under the simulator's lock model:

If:

```text
T1 → T2
T2 → T3
T3 → T1
```

then:

- T1 cannot continue until T2 releases
- T2 cannot continue until T3 releases
- T3 cannot continue until T1 releases

No member can progress independently.

Therefore the cycle is a deadlock.

Conversely, if the WFG has no cycle, there is no circular wait.

---

# 11. DFS implementation

The implementation uses iterative DFS.

Colors:

```text
white = unvisited
grey  = currently active in DFS path
black = completely processed
```

If DFS follows:

```text
T1 → T2
T2 → T1
```

and T1 is grey when T2 points back to T1, the edge is a back edge.

That proves a cycle.

Complexity:

```text
O(V + E)
```

where:

- V = transactions
- E = wait relationships

---

# 12. Why iterative DFS?

A recursive DFS would be simpler conceptually.

The implementation uses an explicit stack:

```text
[node, nextChildIndex]
```

Advantages:

- avoids recursion-depth concerns
- gives explicit control over traversal
- makes recording the animation trace natural

The trace contains events such as:

```text
visit
edge
backtrack
cycleFound
```

---

# 13. Detection engine

File:

```text
client/src/engine/detection.js
```

Simplified flow:

```text
while operations remain:
    get next runnable operation

    if LOCK:
        ask LockManager

        if granted:
            record GRANT

        else:
            mark transaction blocked
            build WFG
            run DFS

            if cycle:
                record DEADLOCK_DETECTED
                choose victim
                rollback victim
                restart victim later
```

---

# 14. Victim selection

Policies:

### Youngest

Select highest timestamp.

Reason:

> Usually less work has been done by a younger transaction.

### Oldest

Select lowest timestamp.

Mostly included for comparison.

### Fewest locks

Choose the transaction holding the fewest locks.

This can reduce rollback state.

### Requester

Choose the transaction whose request completed the cycle.

---

# 15. Rollback

Rollback:

1. releases all locks
2. removes its pending wait
3. gathers operations that need to be restarted
4. clears its executed state
5. increments rollback count
6. places restart operations at the end

Then:

```text
RESTART
```

is recorded.

---

# 16. Why restart?

Rollback without restart would permanently lose the transaction.

A DBMS normally aborts/rolls back a transaction and may retry it.

The simulator models that educationally.

---

# 17. Important limitation

This is a teaching lock manager, not a full production DBMS lock manager.

Limitations:

- only S/X locks
- named data items
- no intention locks
- no range locks
- simplified queue semantics
- detection after every blocked request
- small graph limits for readability

If asked, admit this directly.

---

# 18. Complexity table

| Component | Complexity |
|---|---|
| Lock conflict check | O(holders) |
| WFG construction | O(R·T) in the implemented table scan |
| DFS cycle detection | O(V+E) |
| Victim selection | O(cycle size) |
| Whole simulation | Depends on number of operations/restarts |

---

# 19. Strong panel questions

### Why not just check the schedule for opposite lock requests?

Because deadlocks can be transitive.

Example:

```text
T1 waits T2
T2 waits T3
T3 waits T1
```

The WFG captures the actual runtime dependency graph.

### Why does S/S not conflict?

Both are read locks and neither modifies the data item.

### Why is X incompatible with S?

An exclusive writer must have sole access to preserve isolation.

### Can 2PL still deadlock?

Yes. 2PL gives serializability, not deadlock freedom.

### Is a cycle always a deadlock?

For this lock-based WFG model, yes.

### Is every wait a deadlock?

No.

---

# 20. One-minute speaking script

> My part focuses on the DBMS core. We first parse the schedule into normalized lock operations. The LockManager implements S and X compatibility, tracks holders and waiting requests, and handles lock upgrades. Whenever a request blocks, we construct a Wait-For Graph where an edge Ti to Tj means Ti is waiting for a lock held by Tj. We then run iterative DFS with white, grey and black states. Encountering an edge to a grey node gives us a cycle, which is a deadlock in our model. The detection engine then selects a victim using a configurable policy, rolls it back, releases its locks, and schedules it for restart. The core cycle detection is O(V+E), and the engine records every transition as a serializable step so the frontend can visualize and explain it.
