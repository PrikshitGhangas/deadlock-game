import { Icon } from '../components/common/Icons.jsx';

export default function MasterPage({ onNavigate }) {
  return (
    <div className="master-page" style={{ padding: '28px 24px 60px', maxWidth: 1300, margin: '0 auto' }}>
      {/* Editorial Header */}
      <div
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '32px 36px',
          marginBottom: 32,
          boxShadow: 'var(--shadow)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 840 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--accent-soft)', borderRadius: 999, color: 'var(--accent)', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            <Icon name="lab" size={14} /> Interactive Educational Platform
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '-0.03em' }}>
            DBMS-Laboratory
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
            A unified, execution-grounded laboratory connecting <strong>Database Design</strong>, <strong>Query Processing</strong>, and <strong>Transaction Concurrency Control</strong>. Experiment with custom schemas, visualize algorithm execution step-by-step, and benchmark protocols side-by-side.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
          <span className="badge badge-neutral" style={{ padding: '4px 10px', fontSize: 12 }}>3 Core Syllabus Pillars</span>
          <span className="badge badge-neutral" style={{ padding: '4px 10px', fontSize: 12 }}>8+ Visual Simulators</span>
          <span className="badge badge-neutral" style={{ padding: '4px 10px', fontSize: 12 }}>Deterministic Step Replay</span>
          <span className="badge badge-neutral" style={{ padding: '4px 10px', fontSize: 12 }}>Custom Data Ingestion</span>
        </div>
      </div>

      {/* Domain 1: Database Design Studio */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ display: 'inline-flex', padding: 7, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="table" size={18} />
          </span>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>1. Database Design Studio</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Conceptual data modeling, functional dependencies, closures and normalization ladders.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          {/* Card: ER / EER Designer */}
          <div className="card clickable" onClick={() => onNavigate('lab_er')} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-info">Design & DDL</span>
                <span className="badge badge-ok">Custom Inputs</span>
              </div>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>Open Studio &rarr;</span>
            </div>
            <h3 style={{ fontSize: 18, marginTop: 10 }}>ER / EER Designer & Relational Mapping</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 14px 0' }}>
              Build custom entities, define primary keys, and wire 1:1, 1:N, and M:N relationships. Automatically synthesizes normalized Relational Schemas and ready-to-run SQL <code>CREATE TABLE</code> DDL statements.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Weak Entities</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Junction Tables</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>SQL DDL Generator</span>
            </div>
          </div>

          {/* Card: Normalization Analyzer */}
          <div className="card clickable" onClick={() => onNavigate('lab_norm')} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-info">Schema Quality</span>
                <span className="badge badge-ok">Custom Inputs</span>
              </div>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>Open Studio &rarr;</span>
            </div>
            <h3 style={{ fontSize: 18, marginTop: 10 }}>Normalization & FD Analyzer</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 14px 0' }}>
              Enter arbitrary attribute sets and functional dependencies. Interactively calculate attribute closures (<em>X<sup>+</sup></em>), detect candidate keys, and step through the 1NF &rarr; 2NF &rarr; 3NF &rarr; BCNF diagnostic ladder.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Closure X+</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Candidate Keys</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Partial & Transitive Checks</span>
            </div>
          </div>
        </div>
      </section>

      {/* Domain 2: Query Processing Engine */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ display: 'inline-flex', padding: 7, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="database" size={18} />
          </span>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>2. Query Processing & Optimization</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Relational algebra compilation, heuristic query tree rewrite, and physical storage B+ tree indexing.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          {/* Card: Query Optimizer */}
          <div className="card clickable" onClick={() => onNavigate('lab_query')} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-warn">Optimization</span>
                <span className="badge badge-ok">Custom Inputs</span>
              </div>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>Open Engine &rarr;</span>
            </div>
            <h3 style={{ fontSize: 18, marginTop: 10 }}>Relational Algebra & Query Tree Optimizer</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 14px 0' }}>
              Enter custom SQL queries and tweak table row cardinalities. Compares naive Cartesian product trees against heuristically optimized trees applying selection pushdown, join conversion, and projection pruning.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Selection Pushdown (&sigma;)</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Equi-Join (&fnof;)</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Up to 99% Tuple Savings</span>
            </div>
          </div>

          {/* Card: B+ Tree Indexer */}
          <div className="card clickable" onClick={() => onNavigate('lab_bplus')} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-warn">Storage & Index</span>
                <span className="badge badge-ok">Custom Batch</span>
              </div>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>Open Engine &rarr;</span>
            </div>
            <h3 style={{ fontSize: 18, marginTop: 10 }}>B+ Tree Index Visualizer</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 14px 0' }}>
              Insert single or custom batch keys with parameterizable order <em>M</em>. Animate balanced splits, key copy-up to internal router nodes, step-by-step <em>O(log N)</em> search traces, and linked-leaf range scans.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Order M Splits</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Search Traversal Path</span>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>Leaf Sibling Chaining</span>
            </div>
          </div>
        </div>
      </section>

      {/* Domain 3: Transaction Processing & Concurrency */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ display: 'inline-flex', padding: 7, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="lock" size={18} />
          </span>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>3. Transactions & Concurrency Management</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Serializability, deadlock detection, prevention protocols, avoidance, and multi-algorithm benchmarking.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Card: Precedence Graph */}
          <div className="card clickable" onClick={() => onNavigate('lab_precedence')} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-ok">Serializable</span>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>Launch &rarr;</span>
            </div>
            <h3 style={{ fontSize: 17, marginTop: 8 }}>Conflict Serializability</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 12px 0' }}>
              Precedence graph generator, cycle detection, topological sort equivalent serial schedule, and random schedule generator.
            </p>
            <div className="text-muted" style={{ fontSize: 11, fontWeight: 600 }}>T_i &rarr; T_j Conflict Graph</div>
          </div>

          {/* Card: Algorithm Comparison */}
          <div className="card clickable" onClick={() => onNavigate('lab_compare')} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-info">Benchmark</span>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>Launch &rarr;</span>
            </div>
            <h3 style={{ fontSize: 17, marginTop: 8 }}>Algorithm Comparison</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 12px 0' }}>
              Run custom workloads simultaneously across Detection (2PL), Wait-Die, Wound-Wait, Basic TO, and Thomas Write Rule.
            </p>
            <div className="text-muted" style={{ fontSize: 11, fontWeight: 600 }}>Side-by-side Metrics Matrix</div>
          </div>

          {/* Card: Deadlock Detection */}
          <div className="card clickable" onClick={() => onNavigate('detection')} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-danger">2PL Simulator</span>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>Launch &rarr;</span>
            </div>
            <h3 style={{ fontSize: 17, marginTop: 8 }}>Deadlock Detection</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 12px 0' }}>
              Strict 2PL with live Wait-For Graph, animated depth-first search cycle detection, and victim rollback policies.
            </p>
            <div className="text-muted" style={{ fontSize: 11, fontWeight: 600 }}>WFG + Cycle DFS Visualizer</div>
          </div>

          {/* Card: Deadlock Prevention */}
          <div className="card clickable" onClick={() => onNavigate('prevention')} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-warn">Timestamp</span>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>Launch &rarr;</span>
            </div>
            <h3 style={{ fontSize: 17, marginTop: 8 }}>Deadlock Prevention</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 12px 0' }}>
              Timestamp-driven deadlock prevention comparing non-preemptive Wait-Die against preemptive Wound-Wait.
            </p>
            <div className="text-muted" style={{ fontSize: 11, fontWeight: 600 }}>Wait-Die vs Wound-Wait</div>
          </div>

          {/* Card: Banker's Avoidance */}
          <div className="card clickable" onClick={() => onNavigate('bankers')} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-purple">Avoidance</span>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>Launch &rarr;</span>
            </div>
            <h3 style={{ fontSize: 17, marginTop: 8 }}>Banker's Algorithm</h3>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 12px 0' }}>
              Multiple resource instance avoidance. Vector matrix editor (Available, Max, Allocation, Need) with safety check trace.
            </p>
            <div className="text-muted" style={{ fontSize: 11, fontWeight: 600 }}>Safety Sequence Finder</div>
          </div>
        </div>
      </section>

      {/* Domain 4: Knowledge, Architecture & Developer Hub */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ display: 'inline-flex', padding: 7, borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="book" size={18} />
          </span>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>4. Knowledge, Tools & Credentials</h2>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Theory documentation, audit history, architectural novelty, and project details.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <div className="card clickable" onClick={() => onNavigate('theory')} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Icon name="book" size={16} color="var(--accent)" /> Theory Guide
            </div>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '6px 0 0 0' }}>
              In-depth explanations of ACID, 2PL, WFG, and Banker's algorithms.
            </p>
          </div>

          <div className="card clickable" onClick={() => onNavigate('history')} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Icon name="history" size={16} color="var(--accent)" /> Run History
            </div>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '6px 0 0 0' }}>
              Saved simulation runs, SQLite persistence, and Markdown/JSON export.
            </p>
          </div>

          <div className="card clickable" onClick={() => onNavigate('innovation')} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Icon name="lightbulb" size={16} color="var(--accent)" /> Innovations
            </div>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '6px 0 0 0' }}>
              Key pedagogical and architectural differences from typical classroom tools.
            </p>
          </div>

          <div className="card clickable" onClick={() => onNavigate('about')} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
              <Icon name="users" size={16} color="var(--accent)" /> Developed By
            </div>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '6px 0 0 0' }}>
              Team member profiles, registration numbers, and guide information.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
