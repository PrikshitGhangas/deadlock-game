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

  const opt = useMemo(() => {
    return optimizeQuery(sqlText);
  }, [sqlText]);

  const handlePickSample = (sample) => {
    setSelectedSample(sample.id);
    setSqlText(sample.sql);
    toast?.(`Loaded sample query: ${sample.title}`);
  };

  return (
    <div className="lab-module">
      <div className="lab-header">
        <div>
          <h2>Relational Algebra & Query Tree Optimizer</h2>
          <p className="pane-lead">
            Visualizes the compilation of SQL into Canonical Relational Algebra Query Trees and
            demonstrates heuristic query rewriting (such as selection pushdown and join conversion) to drastically cut intermediate tuple generation.
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

      {/* SQL Editor */}
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="label" htmlFor="sql-query-input">
          SQL Query Definition:
        </label>
        <textarea
          id="sql-query-input"
          className="input-textarea"
          rows={4}
          value={sqlText}
          onChange={(e) => setSqlText(e.target.value)}
          spellCheck="false"
        />
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
