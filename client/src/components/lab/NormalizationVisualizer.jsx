import { useState, useMemo } from 'react';
import {
  analyzeNormalization,
  computeClosure,
  SAMPLE_SCHEMAS,
} from '../../engine/normalization.js';
import { Icon } from '../common/Icons.jsx';

export default function NormalizationVisualizer({ toast }) {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [attributesText, setAttributesText] = useState(SAMPLE_SCHEMAS[0].attributes);
  const [fdsText, setFdsText] = useState(SAMPLE_SCHEMAS[0].fds);
  const [testAttrClosure, setTestAttrClosure] = useState('StudentID');

  const analysis = useMemo(() => {
    return analyzeNormalization(attributesText, fdsText);
  }, [attributesText, fdsText]);

  const customClosure = useMemo(() => {
    if (!analysis.fds || analysis.fds.length === 0) return [];
    return computeClosure(testAttrClosure, analysis.fds);
  }, [testAttrClosure, analysis.fds]);

  const handlePickPreset = (idx) => {
    const s = SAMPLE_SCHEMAS[idx];
    setSelectedPreset(idx);
    setAttributesText(s.attributes);
    setFdsText(s.fds);
    setTestAttrClosure(s.attributes.split(',')[0].trim());
    toast?.(`Loaded schema preset: ${s.name}`);
  };

  return (
    <div className="lab-module">
      <div className="lab-header">
        <div>
          <h2>Normalization & Functional Dependency Analyzer</h2>
          <p className="pane-lead">
            Compute attribute closures (<em>X<sup>+</sup></em>), detect candidate keys, and step through the relational normalization ladder from 1NF to BCNF with automated partial and transitive dependency diagnostics.
          </p>
        </div>
        <div className="lab-actions">
          <span className={`badge ${analysis.highestNormalForm === 'BCNF' ? 'badge-ok' : 'badge-warn'}`}>
            Highest Normal Form: {analysis.highestNormalForm}
          </span>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>Presets:</span>
        {SAMPLE_SCHEMAS.map((s, idx) => (
          <button
            key={idx}
            className={`btn btn-sm ${selectedPreset === idx ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handlePickPreset(idx)}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid-2col">
        {/* Schema & FD Definition */}
        <div className="card">
          <div className="card-header">
            <h3>Relation Schema & Dependencies</h3>
            <span className="badge badge-neutral">{analysis.attributes?.length || 0} Attributes</span>
          </div>

          <label className="label" htmlFor="norm-attributes">
            Relation Attributes (Comma-separated):
          </label>
          <input
            id="norm-attributes"
            type="text"
            className="input-text"
            value={attributesText}
            onChange={(e) => setAttributesText(e.target.value)}
            style={{ width: '100%', marginBottom: 12 }}
          />

          <label className="label" htmlFor="norm-fds">
            Functional Dependencies (One per line: e.g. <code>A -&gt; B, C</code>):
          </label>
          <textarea
            id="norm-fds"
            className="input-textarea"
            rows={5}
            value={fdsText}
            onChange={(e) => setFdsText(e.target.value)}
            spellCheck="false"
          />

          {/* Interactive Closure Calculator */}
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
            <label className="label" htmlFor="test-closure-input" style={{ marginBottom: 4 }}>
              Interactive Attribute Closure (<em>X<sup>+</sup></em>):
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="test-closure-input"
                type="text"
                value={testAttrClosure}
                onChange={(e) => setTestAttrClosure(e.target.value)}
                placeholder="Enter attributes (e.g. StudentID)"
                style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <span className="badge badge-neutral" style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                &#123;{testAttrClosure}&#125;<sup>+</sup> = &#123;{customClosure.join(', ')}&#125;
              </span>
            </div>
          </div>
        </div>

        {/* Normalization Ladder Diagnostics */}
        <div className="card">
          <div className="card-header">
            <h3>Normalization Ladder Diagnostics</h3>
            <span className="badge badge-info">1NF &rarr; 2NF &rarr; 3NF &rarr; BCNF</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: 10, background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>Candidate Keys:</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, fontFamily: 'var(--mono)' }}>
                {analysis.candidateKeysFormatted?.join(', ') || 'None'}
              </div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>Prime Attributes:</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                &#123;{analysis.primeAttributes?.join(', ') || 'None'}&#125;
              </div>
            </div>
          </div>

          {/* Normal Forms Checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 1NF */}
            <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--ok-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>1NF (First Normal Form)</span>
                <span className="badge badge-ok">PASSED</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                All attribute domains are atomic (elementary values).
              </div>
            </div>

            {/* 2NF */}
            <div
              style={{
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: analysis.normalForms?.['2NF'].valid ? 'var(--ok-soft)' : 'var(--danger-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>2NF (Second Normal Form)</span>
                <span className={`badge ${analysis.normalForms?.['2NF'].valid ? 'badge-ok' : 'badge-danger'}`}>
                  {analysis.normalForms?.['2NF'].valid ? 'PASSED' : 'VIOLATED'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                Requires 1NF + No partial dependencies (non-prime attributes depending on a proper subset of candidate keys).
              </div>
              {analysis.normalForms?.['2NF'].violations?.map((v, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4, fontWeight: 600 }}>
                  &bull; {v.reason}
                </div>
              ))}
            </div>

            {/* 3NF */}
            <div
              style={{
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: analysis.normalForms?.['3NF'].valid ? 'var(--ok-soft)' : 'var(--danger-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>3NF (Third Normal Form)</span>
                <span className={`badge ${analysis.normalForms?.['3NF'].valid ? 'badge-ok' : 'badge-danger'}`}>
                  {analysis.normalForms?.['3NF'].valid ? 'PASSED' : 'VIOLATED'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                Requires 2NF + No transitive dependencies. For every non-trivial X &rarr; Y: X is superkey OR Y is prime.
              </div>
              {analysis.normalForms?.['3NF'].violations?.map((v, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4, fontWeight: 600 }}>
                  &bull; {v.reason}
                </div>
              ))}
            </div>

            {/* BCNF */}
            <div
              style={{
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: analysis.normalForms?.['BCNF'].valid ? 'var(--ok-soft)' : 'var(--danger-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>BCNF (Boyce-Codd Normal Form)</span>
                <span className={`badge ${analysis.normalForms?.['BCNF'].valid ? 'badge-ok' : 'badge-danger'}`}>
                  {analysis.normalForms?.['BCNF'].valid ? 'PASSED' : 'VIOLATED'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                For every non-trivial functional dependency X &rarr; Y, X must strictly be a superkey.
              </div>
              {analysis.normalForms?.['BCNF'].violations?.map((v, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4, fontWeight: 600 }}>
                  &bull; {v.reason}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
