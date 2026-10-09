import { useState, useMemo } from 'react';
import { SAMPLE_ER_MODELS, convertErToRelational } from '../../engine/erDesigner.js';
import { Icon } from '../common/Icons.jsx';

export default function ErDesignerVisualizer({ toast }) {
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [model, setModel] = useState(SAMPLE_ER_MODELS[0]);

  // Form states for adding custom entity
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newAttrList, setNewAttrList] = useState([
    { name: 'id', isKey: true, type: 'INT' },
    { name: 'name', isKey: false, type: 'VARCHAR(50)' },
  ]);

  // Form states for adding custom relationship
  const [showRelForm, setShowRelForm] = useState(false);
  const [newRelName, setNewRelName] = useState('');
  const [relEnt1, setRelEnt1] = useState('');
  const [relEnt2, setRelEnt2] = useState('');
  const [relCard, setRelCard] = useState('1:N');
  const [relAttrText, setRelAttrText] = useState('');

  const mapping = useMemo(() => {
    return convertErToRelational(model);
  }, [model]);

  const handlePickModel = (idx) => {
    setSelectedModelIdx(idx);
    setModel(JSON.parse(JSON.stringify(SAMPLE_ER_MODELS[idx])));
    toast?.(`Loaded ER model: ${SAMPLE_ER_MODELS[idx].name}`);
  };

  const handleClearModel = () => {
    setSelectedModelIdx(-1);
    setModel({ id: 'custom', name: 'Custom Schema', entities: [], relationships: [] });
    toast?.('Canvas cleared. Ready for custom entities.');
  };

  // Add custom attribute to the in-progress entity form
  const handleAddAttrField = () => {
    setNewAttrList(prev => [...prev, { name: '', isKey: false, type: 'VARCHAR(50)' }]);
  };

  const handleUpdateAttr = (idx, field, value) => {
    setNewAttrList(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleRemoveAttr = (idx) => {
    setNewAttrList(prev => prev.filter((_, i) => i !== idx));
  };

  // Save the custom entity to model
  const handleSaveEntity = (e) => {
    e.preventDefault();
    const cleanName = newEntityName.trim();
    if (!cleanName) return;
    const validAttrs = newAttrList.filter(a => a.name.trim().length > 0);
    if (validAttrs.length === 0) {
      toast?.('Please add at least one attribute.');
      return;
    }
    const id = cleanName.toUpperCase().replace(/\s+/g, '_');
    if (model.entities.some(ent => ent.id === id)) {
      toast?.(`Entity ${cleanName} already exists.`);
      return;
    }

    const newEnt = {
      id,
      name: cleanName,
      isWeak: false,
      attributes: validAttrs,
    };

    setModel(prev => ({
      ...prev,
      entities: [...prev.entities, newEnt],
    }));

    setNewEntityName('');
    setNewAttrList([
      { name: 'id', isKey: true, type: 'INT' },
      { name: 'name', isKey: false, type: 'VARCHAR(50)' },
    ]);
    setShowEntityForm(false);
    toast?.(`Added custom entity: ${cleanName}`);
  };

  // Delete entity
  const handleDeleteEntity = (entId) => {
    setModel(prev => ({
      ...prev,
      entities: prev.entities.filter(e => e.id !== entId),
      relationships: prev.relationships.filter(r => r.entity1 !== entId && r.entity2 !== entId),
    }));
    toast?.(`Removed entity`);
  };

  // Save custom relationship
  const handleSaveRelationship = (e) => {
    e.preventDefault();
    const name = newRelName.trim();
    if (!name || !relEnt1 || !relEnt2) {
      toast?.('Please provide relationship name and select two entities.');
      return;
    }

    const relAttrs = relAttrText.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(attrName => ({ name: attrName, type: 'VARCHAR(50)' }));

    const newRel = {
      id: name.toUpperCase().replace(/\s+/g, '_'),
      name,
      entity1: relEnt1,
      entity2: relEnt2,
      cardinality: relCard,
      attributes: relAttrs,
    };

    setModel(prev => ({
      ...prev,
      relationships: [...prev.relationships, newRel],
    }));

    setNewRelName('');
    setRelAttrText('');
    setShowRelForm(false);
    toast?.(`Added relationship: ${name} (${relCard})`);
  };

  // Delete relationship
  const handleDeleteRel = (relId) => {
    setModel(prev => ({
      ...prev,
      relationships: prev.relationships.filter(r => r.id !== relId),
    }));
    toast?.(`Removed relationship`);
  };

  return (
    <div className="lab-module">
      <div className="lab-header">
        <div>
          <h2>ER / EER Designer & Relational Schema Mapping</h2>
          <p className="pane-lead">
            Design custom Entity-Relationship models and automatically synthesize normalized <strong>Relational Schemas</strong> and executable <strong>SQL DDL</strong> statements (handling primary keys, foreign keys, and 1:1, 1:N, M:N relationships).
          </p>
        </div>
        <div className="lab-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowEntityForm(v => !v)}>
            <Icon name="check" size={14} style={{ marginRight: 4 }} /> + Add Custom Entity
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (model.entities.length < 2) {
                toast?.('Please create at least two entities first.');
                return;
              }
              setRelEnt1(model.entities[0].id);
              setRelEnt2(model.entities[1].id);
              setShowRelForm(v => !v);
            }}
          >
            <Icon name="git-branch" size={14} style={{ marginRight: 4 }} /> + Add Relationship
          </button>
        </div>
      </div>

      {/* Model Presets & Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>Presets:</span>
        {SAMPLE_ER_MODELS.map((m, idx) => (
          <button
            key={m.id}
            className={`btn btn-sm ${selectedModelIdx === idx ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => handlePickModel(idx)}
          >
            {m.name}
          </button>
        ))}
        <button className="btn btn-sm btn-ghost" onClick={handleClearModel}>
          Clear Canvas
        </button>
      </div>

      {/* Custom Entity Creator Form */}
      {showEntityForm && (
        <div className="card" style={{ marginBottom: 16, border: '2px solid var(--accent)' }}>
          <div className="card-header">
            <h3>Add Custom Entity</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowEntityForm(false)}>Cancel</button>
          </div>
          <form onSubmit={handleSaveEntity}>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Entity Name (e.g. Doctor, Patient, Invoice):</label>
              <input
                type="text"
                placeholder="Entity Name"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                style={{ width: '100%', padding: '7px 10px' }}
                required
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="label" style={{ margin: 0 }}>Attributes:</label>
                <button type="button" className="btn btn-sm btn-ghost" onClick={handleAddAttrField}>
                  + Add Attribute
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {newAttrList.map((attr, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Attribute Name"
                      value={attr.name}
                      onChange={(e) => handleUpdateAttr(idx, 'name', e.target.value)}
                      style={{ flex: 2, padding: '5px 8px' }}
                    />
                    <select
                      value={attr.type}
                      onChange={(e) => handleUpdateAttr(idx, 'type', e.target.value)}
                      style={{ flex: 1.5, padding: '5px 8px' }}
                    >
                      <option value="INT">INT</option>
                      <option value="VARCHAR(50)">VARCHAR(50)</option>
                      <option value="VARCHAR(100)">VARCHAR(100)</option>
                      <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                      <option value="DATE">DATE</option>
                      <option value="BOOLEAN">BOOLEAN</option>
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={attr.isKey}
                        onChange={(e) => handleUpdateAttr(idx, 'isKey', e.target.checked)}
                      />
                      Primary Key
                    </label>
                    {newAttrList.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ color: 'var(--danger)', padding: '2px 6px' }}
                        onClick={() => handleRemoveAttr(idx)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary">
              Save Entity to Model
            </button>
          </form>
        </div>
      )}

      {/* Custom Relationship Creator Form */}
      {showRelForm && (
        <div className="card" style={{ marginBottom: 16, border: '2px solid var(--purple)' }}>
          <div className="card-header">
            <h3>Add Custom Relationship</h3>
            <button className="btn btn-sm btn-ghost" onClick={() => setShowRelForm(false)}>Cancel</button>
          </div>
          <form onSubmit={handleSaveRelationship}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="label">Relationship Name (e.g. Consults, Orders):</label>
                <input
                  type="text"
                  placeholder="Relationship Name"
                  value={newRelName}
                  onChange={(e) => setNewRelName(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                  required
                />
              </div>
              <div>
                <label className="label">Entity 1:</label>
                <select
                  value={relEnt1}
                  onChange={(e) => setRelEnt1(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                >
                  {model.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Entity 2:</label>
                <select
                  value={relEnt2}
                  onChange={(e) => setRelEnt2(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                >
                  {model.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Cardinality:</label>
                <select
                  value={relCard}
                  onChange={(e) => setRelCard(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px' }}
                >
                  <option value="1:1">1:1 (One to One)</option>
                  <option value="1:N">1:N (One to Many)</option>
                  <option value="M:N">M:N (Many to Many - Junction)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="label">Optional Relationship Attributes (comma-separated, e.g. date, rating):</label>
              <input
                type="text"
                placeholder="e.g. date, score"
                value={relAttrText}
                onChange={(e) => setRelAttrText(e.target.value)}
                style={{ width: '100%', padding: '6px 8px' }}
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Save Relationship to Model
            </button>
          </form>
        </div>
      )}

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
                Entities & Attributes ({model.entities.length})
              </h4>
              {model.entities.length === 0 ? (
                <div className="text-muted" style={{ fontSize: 13, padding: 12, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  No entities in canvas. Click <strong>+ Add Custom Entity</strong> above to create one.
                </div>
              ) : (
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
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, color: 'var(--accent)' }}>
                          {ent.name}
                        </div>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ padding: '0 4px', fontSize: 11, color: 'var(--danger)' }}
                          onClick={() => handleDeleteEntity(ent.id)}
                          title="Delete Entity"
                        >
                          ✕
                        </button>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
                        {ent.attributes.map((a, i) => (
                          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span style={{ fontWeight: a.isKey ? 700 : 400, textDecoration: a.isKey ? 'underline' : 'none' }}>
                              {a.name} {a.isKey && '(PK)'}
                            </span>
                            <span className="text-muted" style={{ fontSize: 11 }}>{a.type}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Relationships */}
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: 13, textTransform: 'uppercase', color: 'var(--fg-muted)' }}>
                Relationships ({model.relationships.length})
              </h4>
              {model.relationships.length === 0 ? (
                <div className="text-muted" style={{ fontSize: 13, padding: 12, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  No relationships. Click <strong>+ Add Relationship</strong> to connect entities.
                </div>
              ) : (
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
                        {rel.attributes?.length > 0 && (
                          <span className="text-muted" style={{ marginLeft: 6, fontSize: 11 }}>
                            [{rel.attributes.map(a => a.name).join(', ')}]
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="badge badge-purple">{rel.cardinality}</span>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ padding: '0 4px', fontSize: 11, color: 'var(--danger)' }}
                          onClick={() => handleDeleteRel(rel.id)}
                          title="Delete Relationship"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Synthesized Relational Schema & DDL */}
        <div className="card">
          <div className="card-header">
            <h3>Mapped Relational Schema</h3>
            <span className="badge badge-info">{mapping.tables.length} Tables Generated</span>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-muted)' }}>Schema Notations:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {mapping.schemaNotations.length === 0 ? (
                <div className="text-muted" style={{ fontSize: 12 }}>Add entities to view generated relational schema.</div>
              ) : (
                mapping.schemaNotations.map((sn, idx) => (
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
                ))
              )}
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
              maxHeight: 280,
              margin: 0,
            }}
          >
            {mapping.ddlSql || '-- No tables generated yet'}
          </pre>
        </div>
      </div>
    </div>
  );
}
