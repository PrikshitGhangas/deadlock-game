# Test cases

Automated tests live in `tests/` and run with `npm test` (Vitest). 72 tests, all passing.

| Suite | File | Cases |
|---|---|---|
| Parser | `tests/engine/parser.test.js` | 13 |
| Lock manager | `tests/engine/lockManager.test.js` | 7 |
| Wait-for graph | `tests/engine/waitForGraph.test.js` | 5 |
| Detection / prevention / Banker's | `tests/engine/simulators.test.js` | 16 |
| Game / tutor / report | `tests/engine/game-tutor.test.js` | 17 |
| REST API | `tests/server/api.test.js` | 5 |
| AI tutor (config, request builders, error mapping, routes, context summary) | `tests/server/ai.test.js` | 9 |

## 1. Input validation

| ID | Input | Expected | Automated |
|---|---|---|---|
| V1 | `T1: LOCK-X(A)` … `T1: COMMIT` | ok, 4 ops, canonical text `T1: LOCK-X(A)` | ✔ |
| V2 | `t1: select a` / `T2: update B` | S / X locks, `sql` field set | ✔ |
| V3 | comments `#`, `--`, blank lines | ignored | ✔ |
| V4 | `hello world`, `T1: FOO(A)` | errors on lines 2 and 3 | ✔ |
| V5 | `T1: UNLOCK(A)` without lock | "never requested a lock" | ✔ |
| V6 | op after `COMMIT` | "already committed" | ✔ |
| V7 | `LOCK-X(A)` then `LOCK-S(A)` | redundant lock error | ✔ |
| V8 | empty / comment-only text | "Schedule is empty" | ✔ |
| V9 | 13 transactions | "Too many transactions" | ✔ |
| V10 | Banker's row/column mismatch, Allocation > Max, bad request pid/length | specific errors | ✔ |

## 2. Lock manager
| ID | Scenario | Expected | Automated |
|---|---|---|---|
| L1 | compatibility matrix | S/S only | ✔ |
| L2 | two S holders, X request | blocked by both | ✔ |
| L3 | three X requests, release first | FIFO: second granted, third still waiting | ✔ |
| L4 | S→X upgrade with / without other S holders | granted / blocked, granted after release | ✔ |
| L5 | `releaseAll` | clears holders and queue entries | ✔ |

## 3. Cycle detection
| ID | Graph | Expected | Automated |
|---|---|---|---|
| C1 | chain T1→T2→T3 | no cycle, 3 visits | ✔ |
| C2 | T1⇄T2 | cycle `[T1,T2,T1]`, trace ends with `cycleFound` | ✔ |
| C3 | T1→T2→T3→T4→T2 | cycle `[T2,T3,T4,T2]` | ✔ |

## 4. Simulators (see `docs/SAMPLE_IO.md` for full traces)
| ID | Sample | Expected | Automated |
|---|---|---|---|
| S1 | Classic 2-txn | 1 deadlock, cycle T1→T2→T1, victim T2, both commit | ✔ |
| S2 | 3-txn ring | cycle T1→T2→T3→T1, victim T3 | ✔ |
| S3 | Shared readers | 0 deadlocks, T3 waits on T1 & T2, WFG acyclic at every step | ✔ |
| S4 | Lock upgrade | 1 deadlock, cycle T1→T2→T1 | ✔ |
| S5 | Victim policies | oldest → T1, requester → T2 | ✔ |
| S6 | Locks never released | END reports stuck T2 | ✔ |
| S7 | Wait-die | T1 WAITs, T2 DIEs, T2 re-executes B then A after restart | ✔ |
| S8 | Wound-wait | T1 WOUNDs T2, no WAIT step | ✔ |
| S9 | Both schemes on all samples | never a cycle, 0 deadlocks | ✔ |
| S10 | Banker's textbook | safe, ⟨P1,P3,P4,P0,P2⟩ | ✔ |
| S11 | P1 requests (1,0,2) | granted, Available (2,3,0) | ✔ |
| S12 | P0 requests (0,2,0) after S11 | denied — unsafe | ✔ |
| S13 | request > need / > available | rejected with reason | ✔ |
| S14 | Available (0,0,0), Max > 0 | unsafe | ✔ |

## 5. Game
| ID | Scenario | Expected | Automated |
|---|---|---|---|
| G1 | L1: T1,T1,T1,T2,T2,T2 | won, score 120 | ✔ |
| G2 | L1: T1,T2,T1,T2 | deadlock T1→T2→T1, no moves available | ✔ |
| G3 | hints after T1,T2 | both moves unsafe, −10 points | ✔ |
| G4 | every level | winnable from start **and** can deadlock | ✔ |
| G5 | undo | replays without last move | ✔ |
| G6 | random level seed 42 | deterministic, valid, winnable | ✔ |

## 6. Tutor
| ID | Question | Expected | Automated |
|---|---|---|---|
| T1 | "Is there a deadlock?" | intent `cycle`, mentions T1 → T2 → T1, stepRef = deadlock step | ✔ |
| T2 | "why did T2 get rolled back?" | intent `whyVictim`, mentions youngest | ✔ |
| T3 | "who is T1 waiting for" (at block step) | "T1 waits for T2" | ✔ |
| T4 | "What if I used wound-wait instead?" | re-runs engine, "aborted: T2" | ✔ |
| T5 | "explain step 3" | stepRef 2 | ✔ |
| T6 | "what is a wait-for graph?" | glossary definition | ✔ |
| T7 | Banker's: safe sequence / request denied | correct answers | ✔ |
| T8 | "banana" | fallback + ≥ 4 suggestions | ✔ |

## 7. API
| ID | Scenario | Expected | Automated |
|---|---|---|---|
| A1 | `GET /api/health`, `/api/samples` | ok, ≥ 5 samples | ✔ |
| A2 | POST → GET → export md/json → DELETE history | 201, summary text, markdown, 404 after delete | ✔ |
| A3 | invalid mode / missing result / malformed JSON | 400 | ✔ |
| A4 | scores + tutor log + analytics | best per level, totals, intents | ✔ |
| A5 | unknown `/api/*` | 404 | ✔ |
| A6 | AI not configured: `/api/ai/status` disabled, `/api/ai/ask` → 503 | ✔ |
| A7 | AI configured: status shows provider (never the key); empty / over-long question → 400 | ✔ |
| A8 | Gemini and OpenAI-compatible request bodies built correctly; 401/429/empty answers mapped to friendly errors (mocked fetch) | ✔ |

## 8. Manual UI checks
| ID | Check | Result |
|---|---|---|
| U1 | Run sample 1, step to BLOCK step: DFS animation, "Cycle found" chip, red cycle edges | ✔ |
| U2 | Victim step shows red diamond for T2; T1 wakes | ✔ |
| U3 | Banker's page: matrices, Work/Finish, safe-sequence chips update per step | ✔ |
| U4 | Game L1 win → toast, score saved, "best" chip on level card | ✔ |
| U5 | History: analytics charts, Open reloads run, exports download | ✔ |
| U6 | Dark/light toggle persists; graph recolours | ✔ |
| U7 | 375 px viewport: panes stack, tabs wrap, no horizontal scroll | ✔ |
| U8 | Keyboard: ← → Space Home End step the active tab only | ✔ |
| U9 | Tutor answers through the UI, "Jump to step" link works | ✔ |
| U10 | Largest sample runs in < 5 ms (shown in summary chip) | ✔ |
