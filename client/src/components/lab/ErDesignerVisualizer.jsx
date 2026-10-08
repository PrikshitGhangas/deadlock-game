import { useState, useMemo } from 'react';
import { SAMPLE_ER_MODELS, convertErToRelational } from '../../engine/erDesigner.js';
import { Icon } from '../common/Icons.jsx';

export default function ErDesignerVisualizer({ toast }) {
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [model, setModel] = useState(SAMPLE_ER_MODELS[0]);

  const mapping = useMemo(() => {
    return convertErToRelational(model);
  }, [model]);

  const handlePickModel = (idx) => {
    setSelectedModelIdx(idx);
    setModel(JSON.parse(JSON.stringify(SAMPLE_ER_MODELS[idx])));
    toast?.(`Loaded ER model: ${SAMPLE_ER_MODELS[idx].name}`);
  };

  return (
    <div className="lab-module">
      <div className="lab-header">
        <div>
          <h2>ER / EER Designer & Relational Schema Mapping</h2>
          <p className="pane-lead">
            Design Entity-Relationship models and automatically synthesize normalized <strong>Relational Schemas</strong> and executable <strong>SQL DDL</strong> statements (handling primary keys, foreign keys, and 1:N / M:N relationships).
          </p>
        </div>
        <div className="lab-actions">
          <span className="badge badge-ok">
            <Icon name="check" size={13} style={{ marginRight: 4 }} /> {mapping.tables.length} Relational Tables Generated
          </span>
        </div>
      </div>

      {/* Model Presets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>Sample Models:</span>
        {SAMPLE_ER_MODELS.map((m, idx) => (
          <button
            key={m.id}
            className={`btn btn-sm ${selectedModelIdx === idx ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handlePickModel(idx)}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="grid-2col">
        {/* ER Model Canvas Cards */}
        <div className="card">
          <div className="card-header">
            <h3>Conceptual ER Diagram Structure</h3>
            <span className="badge badge-neutral">{model.entities.length} Entities &bull; {model.relationships.length} Relationships</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Entities */}
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--fg-muted)' }}>
                Entities & Attributes
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {model.entities.map((ent) => (
                  <div
                    key={ent.id}
                    style={{
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elev)',
                      padding: 10,
                      boxShadow: 'var(--shadow)',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 6 }}>
                      {ent.name}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
                      {ent.attributes.map((a, i) => (
                        <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                          <span style={{ fontWeight: a.isKey ? 700 : 400, textDecoration: a.isKey ? 'underline' : 'none' }}>
                            {a.name}
                          </span>
                          <span className="text-muted" style={{ fontSize: 11 }}>{a.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Relationships */}
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--fg-muted)' }}>
                Relationship Links
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {model.relationships.map((rel) => (
                  <div
                    key={rel.id}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-sunken)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <strong>{rel.name}</strong> ({rel.cardinality}) connects <code>{rel.entity1}</code> and <code>{rel.entity2}</code>
                    </div>
                    <span className="badge badge-purple">{rel.cardinality}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Synthesized Relational Schema & DDL */}
        <div className="card">
          <div className="card-header">
            <h3>Mapped Relational Schema</h3>
            <span className="badge badge-info">ER &rarr; Relational Algorithm</span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>Schema Notations:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {mapping.schemaNotations.map((sn, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-sunken)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                  }}
                >
                  {sn}
                </div>
              ))}
            </div>
          </div>

          <label className="label" htmlFor="er-ddl-output">
            Generated SQL DDL (Ready for PostgreSQL / MySQL / SQLite):
          </label>
          <pre
            id="er-ddl-output"
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 12,
              fontFamily: 'var(--mono)',
              fontSize: 12,
              overflowX: 'auto',
              maxHeight: 260,
              margin: 0,
            }}
          >
            {mapping.ddlSql}
          </pre>
        </div>
      </div>
    </div>
  );
}
