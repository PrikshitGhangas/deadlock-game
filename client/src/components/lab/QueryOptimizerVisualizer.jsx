import { useState, useMemo } from 'react';
import { optimizeQuery, SAMPLE_QUERIES } from '../../engine/queryOptimizer.js';
import { Icon } from '../common/Icons.jsx';

function renderTreeNode(node) {
  if (!node) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 6px' }}>
      <div
        style={{
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          background: node.type === 'RELATION'
            ? 'var(--accent-soft)'
            : node.type === 'SELECTION'
            ? 'var(--warn-soft)'
            : node.type === 'JOIN'
            ? 'var(--ok-soft)'
            : 'var(--bg-elev)',
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'center',
          boxShadow: 'var(--shadow)',
          maxWidth: 220,
        }}
      >
        {node.label}
      </div>
      {node.children && node.children.length > 0 && (
        <div style={{ display: 'flex', marginTop: 8, gap: 12, position: 'relative' }}>
          {node.children.map((child, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 1, height: 10, background: 'var(--border-strong)', marginBottom: 2 }} />
              {renderTreeNode(child)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QueryOptimizerVisualizer({ toast }) {
  const [selectedSample, setSelectedSample] = useState(SAMPLE_QUERIES[0].id);
  const [sqlText, setSqlText] = useState(SAMPLE_QUERIES[0].sql);
  const [customStats, setCustomStats] = useState({
    Student: 10000,
    Enrollment: 50000,
    Course: 500,
    Department: 50,
    Employee: 5000,
  });

  const formattedStats = useMemo(() => {
    const res = {};
    for (const [k, v] of Object.entries(customStats)) {
      res[k] = { rows: Number(v) || 1000 };
    }
    return res;
  }, [customStats]);

  const opt = useMemo(() => {
    return optimizeQuery(sqlText, formattedStats);
  }, [sqlText, formattedStats]);

  const handlePickSample = (sample) => {
    setSelectedSample(sample.id);
    setSqlText(sample.sql);
    toast?.(`Loaded sample query: ${sample.title}`);
  };

  const handleUpdateStat = (table, rows) => {
    setCustomStats(prev => ({
      ...prev,
      [table]: Number(rows),
    }));
  };

  return (
    <div className="lab-module">
      <div className="lab-header">
        <div>
          <h2>Relational Algebra & Query Tree Optimizer</h2>
          <p className="pane-lead">
            Visualizes the compilation of SQL into Canonical Relational Algebra Query Trees and
            demonstrates heuristic query rewriting (selection pushdown, join conversion, projection pruning).
            Tweak the custom SQL and table row sizes below to test intermediate tuple reductions.
          </p>
        </div>
        <div className="lab-actions">
          <span className="badge badge-ok">
            <Icon name="check" size={13} style={{ marginRight: 4 }} /> {opt.cost.estimatedSavings} Intermediate Reduction
          </span>
        </div>
      </div>

      {/* Preset Queries */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>Sample Queries:</span>
        {SAMPLE_QUERIES.map((q) => (
          <button
            key={q.id}
            className={`btn btn-sm ${selectedSample === q.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handlePickSample(q)}
          >
            {q.title}
          </button>
        ))}
      </div>

      <div className="grid-2col" style={{ marginBottom: 16 }}>
        {/* Custom SQL Editor */}
        <div className="card">
          <div className="card-header">
            <h3>Custom SQL Query Definition</h3>
            <span className="badge badge-neutral">Arbitrary Input</span>
          </div>
          <textarea
            id="sql-query-input"
            className="input-textarea"
            rows={5}
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            spellCheck="false"
            placeholder="SELECT S.name FROM Student S JOIN Enrollment E ON S.id = E.student_id WHERE E.grade > 8;"
          />
        </div>

        {/* Custom Table Row Estimator */}
        <div className="card">
          <div className="card-header">
            <h3>Custom Table Row Cardinality</h3>
            <span className="badge badge-info">Cost Estimator</span>
          </div>
          <p className="text-muted" style={{ margin: '0 0 10px 0', fontSize: 12 }}>
            Adjust table row counts to see how Cartesian product scale compares against pushdown selections:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {Object.entries(customStats).map(([tbl, rows]) => (
              <label key={tbl} style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontWeight: 600 }}>{tbl}:</span>
                <input
                  type="number"
                  min="10"
                  step="500"
                  value={rows}
                  onChange={(e) => handleUpdateStat(tbl, e.target.value)}
                  style={{ padding: '4px 6px', fontSize: 12 }}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Heuristic Transformation Rules Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        {opt.rulesApplied.map((r, idx) => (
          <div key={idx} style={{ padding: '10px 14px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginBottom: 2 }}>{r.rule}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{r.description}</div>
          </div>
        ))}
      </div>

      {/* Side-by-side Trees */}
      <div className="grid-2col">
        {/* Unoptimized Tree */}
        <div className="card">
          <div className="card-header">
            <h3>Canonical Unoptimized Query Tree</h3>
            <span className="badge badge-warn">Naive Execution</span>
          </div>

          <div style={{ padding: 10, background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>Relational Algebra Formula:</span>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, marginTop: 4, wordBreak: 'break-all' }}>
              {opt.unoptimizedAlgebra}
            </div>
          </div>

          <div style={{ padding: 10, background: 'var(--danger-soft)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
            <strong>Est. Intermediate Candidates:</strong> ~{opt.cost.unoptimizedTuples} tuples (Cartesian Product)
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', padding: 10 }}>
            {renderTreeNode(opt.unoptimizedTree)}
          </div>
        </div>

        {/* Optimized Tree */}
        <div className="card">
          <div className="card-header">
            <h3>Heuristically Optimized Query Tree</h3>
            <span className="badge badge-ok">High Efficiency</span>
          </div>

          <div style={{ padding: 10, background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>Relational Algebra Formula:</span>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, marginTop: 4, wordBreak: 'break-all' }}>
              {opt.optimizedAlgebra}
            </div>
          </div>

          <div style={{ padding: 10, background: 'var(--ok-soft)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
            <strong>Est. Intermediate Candidates:</strong> ~{opt.cost.optimizedTuples} tuples ({opt.cost.estimatedSavings} reduction)
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', padding: 10 }}>
            {renderTreeNode(opt.optimizedTree)}
          </div>
        </div>
      </div>
    </div>
  );
}
