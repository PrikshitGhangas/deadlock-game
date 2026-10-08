# Deadlock Game — 20 High-Probability Panel Questions & Answers

## 1. What problem does your project solve?

It provides an interactive way to understand DBMS deadlocks. Instead of only displaying whether a schedule is deadlocked, it shows lock acquisition, blocking, the Wait-For Graph, DFS cycle detection, victim selection, rollback/restart, prevention schemes, Banker's avoidance, and scheduling decisions.

---

## 2. What exactly is a deadlock?

A deadlock is a state in which a set of transactions are waiting for resources held by other transactions in the same set, so none of them can proceed.

In the lock-based model, a cycle in the Wait-For Graph corresponds to a deadlock.

Example:

```text
T1 → T2
T2 → T1
```

---

## 3. What is the Wait-For Graph?

A Wait-For Graph has:

- one node per transaction
- an edge `Ti → Tj` when Ti is waiting for a lock currently held by Tj

A cycle indicates circular waiting.

The simulator constructs the graph directly from the lock manager's holders and waiting requests.

---

## 4. Why do you use DFS?

DFS is a standard linear-time cycle detection method.

The implementation uses white/grey/black coloring:

- white = unvisited
- grey = currently in DFS path
- black = completely processed

An edge to a grey node is a back edge and indicates a cycle.

Complexity:

```text
O(V + E)
```

---

## 5. Why not just check whether two transactions want each other's locks?

Because deadlocks can contain more than two transactions.

Example:

```text
T1 → T2
T2 → T3
T3 → T1
```

The WFG generalizes the problem and detects arbitrary cycles.

---

## 6. What is the difference between S and X locks?

S is a shared/read lock.

X is an exclusive/write lock.

Compatibility:

```text
S + S = allowed
S + X = conflict
X + S = conflict
X + X = conflict
```

---

## 7. Does 2PL prevent deadlocks?

No.

Two-Phase Locking guarantees conflict serializability, but transactions can hold locks while waiting for other locks, which can create circular wait.

Therefore 2PL and deadlock freedom are different properties.

---

## 8. What are the Coffman conditions?

The four necessary conditions are:

1. Mutual exclusion
2. Hold and wait
3. No preemption
4. Circular wait

A prevention strategy must break at least one of these conditions.

---

## 9. What happens when a deadlock is detected?

The simulator:

1. identifies the cycle
2. selects a victim
3. rolls the victim back
4. releases its locks
5. wakes affected waiters
6. schedules the victim for restart

The goal is to break the cycle while eventually allowing all transactions to finish.

---

## 10. Why choose the youngest transaction as victim?

The simulation's default policy assumes a younger transaction has usually done less work, so rollback may waste less work.

However, there is no universal "youngest is always correct" policy.

The project also supports:

- oldest
- fewest locks
- requester

---

## 11. What is Wait-Die?

Wait-Die is a non-preemptive timestamp prevention scheme.

If Ti requests a resource held by Tj:

```text
Ti older than Tj → Ti waits
Ti younger than Tj → Ti aborts/dies
```

Therefore waits only go from older to younger transactions.

That ordering prevents a circular wait.

---

## 12. What is Wound-Wait?

Wound-Wait is a preemptive timestamp scheme.

If Ti requests a resource held by Tj:

```text
Ti older than Tj → Ti wounds/aborts Tj
Ti younger than Tj → Ti waits
```

Therefore waits only go from younger to older transactions.

Again, a cycle cannot form.

---

## 13. What is the difference between Wait-Die and Wound-Wait?

| | Wait-Die | Wound-Wait |
|---|---|---|
| Older → younger | Wait | Abort younger |
| Younger → older | Abort requester | Wait |
| Preemptive | No | Yes |

Both impose an ordering that prevents circular wait.

---

## 14. What is Banker's Algorithm?

Banker's Algorithm is a deadlock avoidance algorithm.

It assumes each process declares its maximum possible resource demand.

A request is granted only if the resulting state remains safe.

The key calculation is:

```text
Need = Max - Allocation
```

The safety algorithm tries to find an order in which every process can finish.

---

## 15. What is a safe state?

A state is safe if there exists at least one sequence in which all processes can finish using the currently available resources plus resources released by completed processes.

A safe state guarantees deadlock can be avoided under the declared maximum demands.

---

## 16. Is unsafe the same as deadlocked?

No.

Unsafe means the system cannot guarantee a completion sequence.

Deadlocked means processes are actually stuck.

Therefore:

```text
deadlocked ⇒ unsafe
unsafe ⇏ necessarily deadlocked
```

In the Banker model, an unsafe request is denied because the system cannot prove that granting it will avoid deadlock.

---

## 17. Why can Banker's Algorithm deny a request that fits in Available?

Because:

```text
Request ≤ Available
```

is only one condition.

The Banker also performs a safety check.

A request can fit immediately but still make the resulting state unsafe.

The project demonstrates exactly this case.

---

## 18. Why is the Game hint algorithm exhaustive?

The game asks a stronger question:

> Does there exist some future sequence of choices that still allows every transaction to commit?

The implementation explores reachable states recursively and memoizes them.

It is practical because levels are intentionally small.

It is not intended to be a scalable general-purpose scheduling algorithm.

---

## 19. Why use SQLite if the simulation runs in the browser?

The simulation does not require SQLite.

SQLite is used for persistent application features:

- saved simulations
- scores
- tutor logs
- analytics
- exports

This separation keeps the core algorithm deterministic and easy to test.

---

## 20. What is the most important limitation of your project?

It is an educational simulator, not a complete production DBMS lock manager.

It supports simplified S/X locks on named resources and does not model features such as:

- intention locks
- range/predicate locks
- full transaction logging/recovery
- distributed locking
- all DBMS-specific deadlock policies

The game search is also intentionally limited to small state spaces.

A strong future direction would be to add richer lock types, realistic transaction workloads, database-specific policies and larger-scale simulation.
