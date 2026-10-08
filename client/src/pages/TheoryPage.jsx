const SECTIONS = [
  ['what', 'What is a deadlock?'], ['coffman', 'Coffman conditions'], ['wfg', 'Wait-for graph & detection'],
  ['victim', 'Victim selection'], ['prevention', 'Prevention: wait-die & wound-wait'], ['bankers', "Avoidance: Banker's algorithm"],
  ['compare', 'Comparison & complexity'], ['real', 'Real-world DBMS behaviour'], ['limits', 'Limitations'], ['refs', 'References'],
];

export default function TheoryPage({ onTab }) {
  return (
    <main className="page prose" aria-labelledby="tab-theory">
      <h1>Deadlocks in database systems</h1>
      <p style={{ color: 'var(--fg-muted)' }}>Background theory for the simulator. Each section links to the mode where you can try it.</p>
      <nav className="toc" aria-label="Contents">{SECTIONS.map(([id, t]) => <a key={id} className="chip chip-btn" href={`#${id}`}>{t}</a>)}</nav>

      <h2 id="what">What is a deadlock?</h2>
      <p>Under <strong>lock-based concurrency control</strong> a transaction must obtain a <em>shared (S)</em> lock to read an item and an <em>exclusive (X)</em> lock to write it. Two S locks are compatible; every other combination conflicts, so the requester must <strong>wait</strong>. A <strong>deadlock</strong> is a set of transactions in which every member waits for a lock held by another member — none of them can ever proceed without outside intervention.</p>
      <pre>{`T1: LOCK-X(A)   ← T1 holds A
T2: LOCK-X(B)   ← T2 holds B
T1: LOCK-X(B)   ← T1 waits for T2
T2: LOCK-X(A)   ← T2 waits for T1  ⇒ deadlock`}</pre>
      <div className="callout">Two-phase locking (2PL) guarantees serialisable schedules but does <strong>not</strong> prevent deadlocks. Every lock-based DBMS therefore needs one of three strategies: <em>detection</em>, <em>prevention</em>, or <em>avoidance</em>.</div>

      <h2 id="coffman">Coffman conditions</h2>
      <p>Deadlock can occur only if all four conditions hold simultaneously:</p>
      <ol>
        <li><strong>Mutual exclusion</strong> — an X lock can be held by one transaction at a time.</li>
        <li><strong>Hold and wait</strong> — a transaction keeps its locks while waiting for more.</li>
        <li><strong>No preemption</strong> — locks are released only voluntarily (at commit/abort).</li>
        <li><strong>Circular wait</strong> — a cycle of transactions each waiting for the next.</li>
      </ol>
      <p>Prevention schemes break one condition: wound-wait breaks <em>no preemption</em>, wait-die breaks <em>hold and wait</em> (the younger transaction gives up its locks), and the Banker's algorithm never lets <em>circular wait</em> become possible.</p>

      <h2 id="wfg">Wait-for graph & detection <button className="btn btn-sm" onClick={() => onTab('detection')}>try it →</button></h2>
      <p>The <strong>wait-for graph (WFG)</strong> has one node per active transaction and an edge <code>Ti → Tj</code> whenever Ti waits for an item locked by Tj. <strong>A deadlock exists if and only if the WFG contains a cycle.</strong></p>
      <p>The simulator rebuilds the graph after every blocked request and runs an <strong>iterative depth-first search</strong> with white/grey/black colouring: reaching a <em>grey</em> (on the current path) node closes a cycle. Cost: <code>O(V + E)</code> — linear in the number of transactions and wait edges. Real systems run the check periodically (PostgreSQL after <code>deadlock_timeout</code>, default 1 s) or on every wait (InnoDB).</p>

      <h2 id="victim">Victim selection</h2>
      <p>Once a cycle is found, one transaction in it is <strong>rolled back</strong> (its locks are released and it restarts). The choice trades off lost work, held locks, and fairness:</p>
      <table className="data">
        <thead><tr><th>Policy</th><th>Idea</th><th>Used by</th></tr></thead>
        <tbody>
          <tr><td>Youngest</td><td>Least work lost; keep the original timestamp on restart to avoid starvation</td><td>Common textbook default</td></tr>
          <tr><td>Fewest locks</td><td>Approximates the cheapest rollback</td><td>InnoDB (fewest rows modified)</td></tr>
          <tr><td>Requester / last in cycle</td><td>The transaction whose request closed the cycle</td><td>Simple detectors</td></tr>
          <tr><td>Lowest deadlock priority</td><td>User-set priority, then estimated rollback cost</td><td>SQL Server (<code>SET DEADLOCK_PRIORITY</code>)</td></tr>
        </tbody>
      </table>

      <h2 id="prevention">Prevention: wait-die & wound-wait <button className="btn btn-sm" onClick={() => onTab('prevention')}>try it →</button></h2>
      <p>Each transaction gets a <strong>timestamp</strong> when it starts (smaller = older). When Ti requests a lock held by Tj:</p>
      <table className="data">
        <thead><tr><th></th><th>Ti older than Tj</th><th>Ti younger than Tj</th><th>Type</th></tr></thead>
        <tbody>
          <tr><th>Wait-die</th><td>Ti <strong>waits</strong></td><td>Ti <strong>dies</strong> (aborts, restarts with same TS)</td><td>non-preemptive</td></tr>
          <tr><th>Wound-wait</th><td>Ti <strong>wounds</strong> Tj (Tj aborts)</td><td>Ti <strong>waits</strong></td><td>preemptive</td></tr>
        </tbody>
      </table>
      <p>Because waiting is only ever allowed in one direction of the timestamp order, the WFG can never contain a cycle. The price is <em>unnecessary rollbacks</em>: a transaction may be aborted even though no deadlock would have occurred. Restarted transactions keep their timestamp so they eventually become the oldest and cannot starve.</p>

      <h2 id="bankers">Avoidance: Banker's algorithm <button className="btn btn-sm" onClick={() => onTab('bankers')}>try it →</button></h2>
      <p>Avoidance requires each process to declare its <strong>maximum demand</strong> (Max) in advance. With <em>n</em> processes and <em>m</em> resource types, <code>Need = Max − Allocation</code>. A state is <strong>safe</strong> if some ordering (a <em>safe sequence</em>) lets every process obtain its full Need and finish.</p>
      <pre>{`Safety algorithm            O(n² · m)
  Work = Available; Finish[i] = false
  repeat: find i with Finish[i] = false and Need[i] ≤ Work
          Work += Allocation[i]; Finish[i] = true
  safe ⇔ all Finish[i] = true

Resource-request algorithm (process i requests R)
  1. R ≤ Need[i]      else error
  2. R ≤ Available    else wait
  3. tentatively grant, run safety algorithm
     safe   → commit the grant
     unsafe → roll back, process waits`}</pre>
      <div className="callout"><strong>Unsafe ≠ deadlocked.</strong> An unsafe state only means the Banker cannot <em>prove</em> that all processes will finish. Avoidance is rarely used in DBMSs because transactions do not know their future lock set; it is included here because it is the classic avoidance technique in OS and DBMS courses.</div>

      <h2 id="compare">Comparison & complexity</h2>
      <table className="data">
        <thead><tr><th>Strategy</th><th>Algorithm</th><th>Complexity</th><th>Aborts</th><th>Needs future knowledge?</th></tr></thead>
        <tbody>
          <tr><td>Detection</td><td>WFG cycle detection (DFS)</td><td>O(V+E) per check</td><td>Only real deadlocks</td><td>No</td></tr>
          <tr><td>Prevention</td><td>Wait-die / wound-wait timestamps</td><td>O(1) per request</td><td>Possibly unnecessary</td><td>No</td></tr>
          <tr><td>Avoidance</td><td>Banker's safety check</td><td>O(n²·m) per request</td><td>None (requests are delayed)</td><td>Yes (Max)</td></tr>
        </tbody>
      </table>

      <h2 id="real">Real-world DBMS behaviour</h2>
      <ul>
        <li><strong>MySQL / InnoDB</strong> — checks the wait-for graph on every lock wait (<code>innodb_deadlock_detect</code>) and rolls back the transaction that modified the fewest rows; <code>SHOW ENGINE INNODB STATUS</code> prints the last deadlock.</li>
        <li><strong>PostgreSQL</strong> — waits <code>deadlock_timeout</code> (1 s) before running detection, then aborts one transaction with error 40P01.</li>
        <li><strong>SQL Server</strong> — a lock monitor thread searches every 5 s (faster after a deadlock) and picks the victim with the lowest <code>DEADLOCK_PRIORITY</code>, then the cheapest rollback (error 1205).</li>
        <li><strong>Oracle</strong> — detects immediately and raises ORA-00060 in the statement that closed the cycle.</li>
        <li><strong>Application-level fixes</strong> — access tables/rows in a consistent global order, keep transactions short, use <code>SELECT … FOR UPDATE</code> to avoid lock-upgrade deadlocks, and retry on deadlock errors.</li>
      </ul>

      <h2 id="limits">Limitations of this simulator</h2>
      <ul>
        <li>Only two lock modes (S/X) on named items — no intention locks, ranges, or multi-granularity locking.</li>
        <li>Requests are granted immediately when compatible with current holders (no queue-order fairness rule), matching the textbook lock manager.</li>
        <li>Detection runs after every blocked request rather than periodically; prevention uses first-appearance order as the timestamp.</li>
        <li>Restarted transactions are appended to the end of the schedule; real systems re-execute application code.</li>
        <li>The game's hint search enumerates the full state space, which is only practical for small levels (≤ 4 transactions).</li>
      </ul>

      <h2 id="refs">References</h2>
      <ol>
        <li>A. Silberschatz, H. Korth, S. Sudarshan, <em>Database System Concepts</em>, 7th ed., ch. 18 (Concurrency Control) — deadlock handling, wait-die / wound-wait, victim selection.</li>
        <li>R. Elmasri, S. Navathe, <em>Fundamentals of Database Systems</em>, 7th ed., ch. 21 — locking, deadlock prevention and detection.</li>
        <li>A. Silberschatz, P. Galvin, G. Gagne, <em>Operating System Concepts</em>, 10th ed., ch. 8 — Banker's algorithm (source of the 5×3 example).</li>
        <li>E. G. Coffman, M. Elphick, A. Shoshani, “System Deadlocks”, <em>ACM Computing Surveys</em> 3(2), 1971.</li>
        <li>MySQL 8.0 Reference Manual — “Deadlocks in InnoDB”, “Deadlock Detection”.</li>
        <li>PostgreSQL Documentation — “Deadlocks” (ch. 13.3), <code>deadlock_timeout</code>.</li>
        <li>Microsoft SQL Server docs — “Deadlocks guide”.</li>
      </ol>
    </main>
  );
}
