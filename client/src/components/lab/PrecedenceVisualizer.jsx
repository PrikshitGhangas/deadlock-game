import { useState, useMemo } from 'react';
import { analyzeConflictSerializability, generateRandomSchedule } from '../../engine/precedenceGraph.js';
import { Icon } from '../common/Icons.jsx';

const PRESET_SCHEDULES = [
  {
    name: 'Conflict Serializable (Acyclic)',
    schedule: 'T1: R(A)\nT2: W(A)\nT1: W(B)\nT2: R(B)', // wait, let's make sure this is acyclic: T1: R(A), T2: W(A) => T1->T2. T1: W(B), T2: R(B) => T1->T2. Both T1->T2!
  },
  {
    name: 'Classic Cycle (Not Serializable)',
    schedule: 'T1: R(A)\nT2: W(A)\nT2: W(B)\nT1: R(B)', // T1->T2 (A), T2->T1 (B) => Cycle!
  },
  {
    name: 'Three-Transaction Pipeline (T1 -> T2 -> T3)',
    schedule: 'T1: W(A)\nT2: R(A)\nT2: W(B)\nT3: R(B)',
  },
  {
    name: 'Three-Transaction Deadlock-like Cycle',
    schedule: 'T1: R(A)\nT2: W(A)\nT2: R(B)\nT3: W(B)\nT3: R(C)\nT1: W(C)',
  },
];

export default function PrecedenceVisualizer({ toast }) {
  const [scheduleText, setScheduleText] = useState(PRESET_SCHEDULES[1].schedule);
  const [randTxns, setRandTxns] = useState(3);
  const [randOps, setRandOps] = useState(8);
  const [conflictProb, setConflictProb] = useState(0.7);

  const analysis = useMemo(() => {
    return analyzeConflictSerializability(scheduleText);
  }, [scheduleText]);

  const handleRandomize = () => {
    const generated = generateRandomSchedule({
      numTxns: Number(randTxns),
      numItems: 3,
      numOps: Number(randOps),
      conflictProbability: Number(conflictProb),
    });
    setScheduleText(generated.scheduleText);
    toast?.('Generated new random workload schedule');
  };

  return (
    <div className="lab-module">
      <div className="lab-header">
        <div>
          <h2>Conflict Serializability & Precedence Graph</h2>
          <p className="pane-lead">
            Evaluates whether concurrent transaction interleavings are conflict equivalent to a serial execution.
            Contrasts the <strong>Precedence Graph</strong> (conflict order: <em>T<sub>i</sub> &rarr; T<sub>j</sub></em>) against a <strong>Wait-For Graph</strong> (lock waiting: <em>T<sub>i</sub> &rarr; T<sub>j</sub></em>).
          </p>
        </div>
        <div className="lab-actions">
          <button className="btn btn-primary" onClick={handleRandomize}>
            <Icon name="sparkles" size={15} style={{ marginRight: 6 }} /> Random Schedule
          </button>
        </div>
      </div>

      <div className="grid-2col">
        {/* Input Column */}
        <div className="card">
          <div className="card-header">
            <h3>Schedule Input & Configuration</h3>
            <span className="badge badge-neutral">{analysis.ops.length} Operations</span>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="label">Sample Presets:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRESET_SCHEDULES.map((p, idx) => (
                <button
                  key={idx}
                  className="btn btn-ghost btn-sm"
                  onClick={() => setScheduleText(p.schedule)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <label className="label" htmlFor="precedence-schedule">
            Schedule Operations (One per line: e.g. <code>T1: R(A)</code>, <code>T2: W(A)</code>):
          </label>
          <textarea
            id="precedence-schedule"
            className="input-textarea"
            rows={8}
            value={scheduleText}
            onChange={(e) => setScheduleText(e.target.value)}
            placeholder="T1: R(A)&#10;T2: W(A)&#10;T1: W(B)"
            spellCheck="false"
          />

          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Random Generator Controls:</span>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                Txns:
                <input
                  type="number"
                  min="2"
                  max="6"
                  value={randTxns}
                  onChange={(e) => setRandTxns(e.target.value)}
                  style={{ width: 50, padding: 4 }}
                />
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                Ops:
                <input
                  type="number"
                  min="4"
                  max="16"
                  value={randOps}
                  onChange={(e) => setRandOps(e.target.value)}
                  style={{ width: 50, padding: 4 }}
                />
              </label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                Conflict Bias:
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={conflictProb}
                  onChange={(e) => setConflictProb(e.target.value)}
                />
                <span>{Math.round(conflictProb * 100)}%</span>
              </label>
            </div>
          </div>
        </div>

        {/* Diagnostic Verdict Column */}
        <div className="card">
          <div className="card-header">
            <h3>Serializability Verdict</h3>
            {analysis.isConflictSerializable ? (
              <span className="badge badge-ok">
                <Icon name="check" size={13} style={{ marginRight: 4 }} /> Conflict Serializable
              </span>
            ) : (
              <span className="badge badge-danger">
                <Icon name="warn" size={13} style={{ marginRight: 4 }} /> Cycle Detected (Non-Serializable)
              </span>
            )}
          </div>

          <div style={{ padding: '12px 16px', background: analysis.isConflictSerializable ? 'var(--ok-soft)' : 'var(--danger-soft)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
            <p style={{ margin: 0, fontWeight: 600, color: analysis.isConflictSerializable ? 'var(--ok)' : 'var(--danger)' }}>
              {analysis.summary}
            </p>
            {analysis.equivalentSerialSchedule && (
              <p style={{ margin: '6px 0 0 0', fontSize: 14 }}>
                <strong>Equivalent Serial Schedule:</strong> <code>{analysis.equivalentSerialSchedule}</code>
              </p>
            )}
            {analysis.hasCycle && (
              <p style={{ margin: '6px 0 0 0', fontSize: 14 }}>
                <strong>Cycle Path:</strong> <code>{analysis.cycles[0]?.join(' \u2192 ')}</code>
              </p>
            )}
          </div>

          <h4>Precedence Graph Structure</h4>
          {analysis.edges.length === 0 ? (
            <p className="text-muted">No conflicting operations found between different transactions.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
              {analysis.edges.map((e, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elev)',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{e.from}</span>
                  <span>&rarr;</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{e.to}</span>
                  <span className="badge badge-neutral" style={{ fontSize: 11 }}>{e.label}</span>
                </div>
              ))}
            </div>
          )}

          <h4 style={{ marginTop: 16 }}>Conflicting Operations Detected ({analysis.conflicts.length})</h4>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Conflict Type</th>
                  <th>Data Item</th>
                  <th>Preceding Op</th>
                  <th>Succeeding Op</th>
                </tr>
              </thead>
              <tbody>
                {analysis.conflicts.map((c, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-warn">{c.type}</span></td>
                    <td><strong>{c.item}</strong></td>
                    <td>{c.from} {c.op1.type}({c.item}) (line {c.op1.index + 1})</td>
                    <td>{c.to} {c.op2.type}({c.item}) (line {c.op2.index + 1})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
