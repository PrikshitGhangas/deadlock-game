# Member 3 — Backend, SQLite, APIs, Persistence & Testing

## Assigned part

Present and defend:

- Node/Express backend
- SQLite schema
- REST API
- history
- game scores
- tutor logs
- analytics
- export
- optional AI proxy
- testing
- integration architecture
- security/design limitations

Also understand the client engine and algorithms conceptually.

---

# 1. Backend architecture

Server:

```text
Node.js
Express
node:sqlite
```

Main structure:

```text
server/
 ├── app.js
 ├── index.js
 ├── db.js
 ├── ai.js
 └── routes/
      ├── history.js
      ├── scores.js
      ├── tutor.js
      ├── analytics.js
      └── ai.js
```

---

# 2. Why a backend?

The deadlock simulation itself can run in the browser.

The backend exists for persistent features:

- saved simulations
- game scores
- tutor logs
- analytics
- exports
- optional AI access

This separation keeps the core simulator independent from the database.

---

# 3. SQLite schema

The database contains three main tables.

## simulations

Stores:

```text
id
mode
title
input_json
result_json
summary
deadlocks
steps
created_at
```

This allows a complete simulation to be reconstructed later.

## game_scores

Stores:

```text
level
level_name
score
moves
hints_used
deadlocked
created_at
```

## tutor_logs

Stores:

```text
simulation_id
mode
question
intent
answer
created_at
```

---

# 4. Why JSON inside SQLite?

Simulation input and result structures are nested.

For example, a result contains:

```text
steps
lock tables
graphs
DFS traces
metadata
explanations
```

Instead of creating dozens of relational tables for every simulation detail, the project stores the complete structured payload as JSON text.

The database remains relational for:

- identity
- mode
- summary
- counts
- timestamps
- analytics fields

while JSON preserves the complex simulation object.

If asked about a production redesign:

> For a large production system, frequently queried fields could be normalized into separate relational tables, with JSON retained for event payloads.

---

# 5. WAL mode

The database executes:

```sql
PRAGMA journal_mode = WAL;
```

WAL means Write-Ahead Logging.

Benefits include:

- better read/write concurrency
- readers can often proceed while writes are being recorded
- improved crash behavior compared with simplistic rollback journaling

For a small educational application, this is more than sufficient.

---

# 6. API structure

Important routes:

```text
GET  /api/health
GET  /api/samples

GET  /api/history
POST /api/history
GET  /api/history/:id
DELETE /api/history/:id
DELETE /api/history

GET /api/history/:id/export?format=md|json

GET  /api/scores
POST /api/scores

GET  /api/analytics

GET  /api/tutor-log
POST /api/tutor-log

GET  /api/ai/status
POST /api/ai/ask
```

---

# 7. History workflow

When the user saves a simulation:

```text
React
 ↓ POST /api/history
Express route
 ↓
validate input
 ↓
serialize input/result
 ↓
INSERT into simulations
 ↓
return saved run
```

When reopening:

```text
GET /api/history/:id
 ↓
read row
 ↓
parse input_json/result_json
 ↓
React reloads run
```

---

# 8. Export

History supports:

```text
Markdown
JSON
```

Markdown is human-readable.

JSON is machine-readable/re-importable.

The server generates the Markdown representation from the stored simulation.

---

# 9. Analytics

The analytics route uses SQL aggregation.

Examples:

```sql
COUNT(*)
SUM(...)
AVG(...)
GROUP BY mode
GROUP BY level
```

This produces:

- total runs
- deadlock counts
- average steps
- runs by mode
- game scores
- best score per level
- tutor intent frequency
- daily activity

---

# 10. Why analytics belongs on the server

Analytics aggregate persistent historical data.

Doing it only in the browser would require downloading all stored records.

The server can perform:

```text
GROUP BY
COUNT
SUM
AVG
MAX
```

directly in SQLite.

This is a natural database workload.

---

# 11. AI API

The AI endpoint:

```text
POST /api/ai/ask
```

does not let the browser directly call the LLM provider.

Instead:

```text
Browser
 ↓
Express
 ↓
LLM provider
```

This prevents exposing the provider API key to the browser.

---

# 12. AI request validation

The server validates:

- question exists
- question length
- context size
- conversation history structure

There are explicit limits such as:

```text
MAX_Q = 1000
MAX_CTX = 12000
MAX_HISTORY = 8
```

This prevents unnecessarily huge requests.

---

# 13. AI grounding

The request contains:

```text
SIMULATION DATA
RULE-ENGINE ANSWER
STUDENT QUESTION
```

This is important.

The deterministic simulator knows:

```text
who owns a lock
who is waiting
which cycle exists
which transaction was aborted
```

The LLM does not have to infer these facts.

It explains them.

---

# 14. Testing architecture

The project uses:

```text
Vitest
Supertest
```

Tests cover:

### Parser

- valid schedules
- invalid syntax
- redundant locks
- invalid unlock
- Banker's validation

### LockManager

- compatibility
- granting
- blocking
- queues
- upgrades
- release

### WFG

- graph construction
- cycle detection
- acyclic graphs

### Simulators

- detection
- prevention
- Banker
- sample scenarios

### Game/Tutor

- winning levels
- deadlock levels
- hints
- undo
- tutor intents

### API

- health
- history
- exports
- scores
- analytics
- AI status/errors

---

# 15. Why unit-test the engine?

Deadlock algorithms are stateful.

A visual demo can look correct while the underlying state is wrong.

Unit tests verify:

```text
input
 ↓
deterministic output
```

independently of React.

This is one of the strongest architecture decisions in the project.

---

# 16. Why API tests?

The backend can fail independently of the frontend.

Supertest allows HTTP-level checks such as:

```text
POST /api/history
GET /api/history
GET /api/history/:id/export
DELETE /api/history/:id
```

This validates the integration contract.

---

# 17. Important distinction: core vs persistence

This is a likely panel question.

### Core simulation

Runs in:

```text
client/src/engine/
```

It handles:

```text
locks
WFG
DFS
detection
prevention
Banker
game
tutor
```

### Backend

Handles:

```text
persistence
analytics
exports
scores
tutor logs
optional AI
```

Therefore:

> The database is part of the application architecture, but the deadlock algorithms are not implemented as SQL queries.

---

# 18. Potential database normalization question

If asked:

> Is storing input_json and result_json normalized?

Answer:

> It is a deliberate hybrid design rather than strict normalization. The metadata needed for filtering and analytics is stored in relational columns, while the highly nested simulation trace is stored as JSON. This avoids creating a very large relational schema for transient algorithmic state. A production analytics-heavy system could normalize selected event data further.

---

# 19. Security limitations

Do not claim the project is production-secure.

Current project is educational.

Potential improvements:

- authentication
- authorization
- rate limiting
- stricter CORS
- CSRF strategy where applicable
- stronger validation
- audit logging
- encrypted secrets management
- production DB
- HTTPS
- stronger AI abuse controls

The current API has input validation and body-size limits, but that is not equivalent to full production security.

---

# 20. One-minute speaking script

> My part focuses on the server and database layer. The core simulator runs deterministically in the client, while our Express backend provides persistence and application services. SQLite stores complete simulation inputs and results, game scores and tutor logs. We expose REST APIs for history, scores, analytics and exports, and the analytics endpoint performs SQL aggregation such as count, average and grouping by mode or level. The optional AI tutor is also proxied through the server so the provider API key never reaches the browser. We used Vitest for deterministic engine tests and Supertest for HTTP API tests. This separation lets us test the DBMS algorithms independently from the UI and also gives us persistent history and analytics.
