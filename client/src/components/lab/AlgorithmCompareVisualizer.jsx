import { useState, useMemo } from 'react';
import { compareConcurrencyAlgorithms } from '../../engine/algorithmCompare.js';
import { Icon } from '../common/Icons.jsx';

const COMPARE_SCHEDULES = [
  {
    name: 'Classic Deadlock Pair',
    schedule: [
      'T1: LOCK-X(A)',
      'T2: LOCK-X(B)',
      'T1: LOCK-X(B)',
      'T2: LOCK-X(A)',
    ].join('\n'),
  },
  {
    name: 'Multi-Item Contention',
    schedule: [
      'T1: LOCK-S(A)',
      'T2: LOCK-X(A)',
      'T3: LOCK-S(B)',
      'T1: LOCK-X(B)',
      'T2: LOCK-S(C)',
      'T3: LOCK-X(C)',
    ].join('\n'),
  },
  {
    name: 'Sequential High-Throughput',
    schedule: [
      'T1: LOCK-X(A)',
      'T1: UNLOCK(A)',
      'T1: COMMIT',
      'T2: LOCK-X(A)',
      'T2: UNLOCK(A)',
      'T2: COMMIT',
    ].join('\n'),
  },
];

export default function AlgorithmCompareVisualizer({ toast }) {
  const [scheduleText, setScheduleText] = useState(COMPARE_SCHEDULES[0].schedule);

  const report = useMemo(() => {
    return compareConcurrencyAlgorithms(scheduleText);
  }, [scheduleText]);

  return (
    <div className="lab-module">
      <div className="lab-header">
        <div>
          <h2>Concurrency Control Algorithm Benchmark & Comparison</h2>
          <p className="pane-lead">
            Runs an identical concurrent schedule side-by-side across <strong>Detection (2PL)</strong>, <strong>Wait-Die</strong>, <strong>Wound-Wait</strong>, <strong>Basic Timestamp Ordering</strong>, and <strong>Thomas Write Rule</strong>.
          </p>
        </div>
        <div className="lab-actions">
          <span className="badge badge-info">5 Protocols Benchmarked</span>
        </div>
      </div>

      {/* Preset selection */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>Workload Presets:</span>
        {COMPARE_SCHEDULES.map((s, idx) => (
          <button
            key={idx}
            className="btn btn-ghost btn-sm"
            onClick={() => { setScheduleText(s.schedule); toast?.(`Loaded workload: ${s.name}`); }}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Schedule Input */}
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="label" htmlFor="benchmark-schedule">
          Workload Schedule Text:
        </label>
        <textarea
          id="benchmark-schedule"
          className="input-textarea"
          rows={5}
          value={scheduleText}
          onChange={(e) => setScheduleText(e.target.value)}
          spellCheck="false"
        />
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <div className="card">
        <div className="card-header">
          <h3>Comparative Performance Metrics</h3>
          <span className="badge badge-neutral">Side-by-Side Evaluation</span>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Protocol Algorithm</th>
                <th>Category / Family</th>
                <th>Status</th>
                <th>Aborts / Rollbacks</th>
                <th>Total Steps</th>
                <th>Throughput</th>
                <th>Core Mechanism</th>
              </tr>
            </thead>
            <tbody>
              {report.algorithms.map((alg, idx) => (
                <tr key={idx}>
                  <td><strong>{alg.name}</strong></td>
                  <td><span className="badge badge-neutral">{alg.category}</span></td>
                  <td>
                    <span className={`badge ${alg.aborts === 0 ? 'badge-ok' : 'badge-warn'}`}>
                      {alg.status}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: alg.aborts > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      {alg.aborts}
                    </strong>
                  </td>
                  <td>{alg.totalSteps}</td>
                  <td>{alg.completedTxns || 'N/A'}</td>
                  <td style={{ fontSize: 12, color: 'var(--fg-muted)', maxWidth: 280 }}>
                    {alg.philosophy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 16px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Architectural Takeaway:</div>
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            {report.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
