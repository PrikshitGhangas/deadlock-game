import { useState, useEffect } from 'react';
import { Icon } from '../components/common/Icons.jsx';
import ErDesignerVisualizer from '../components/lab/ErDesignerVisualizer.jsx';
import NormalizationVisualizer from '../components/lab/NormalizationVisualizer.jsx';
import QueryOptimizerVisualizer from '../components/lab/QueryOptimizerVisualizer.jsx';
import BPlusTreeVisualizer from '../components/lab/BPlusTreeVisualizer.jsx';
import PrecedenceVisualizer from '../components/lab/PrecedenceVisualizer.jsx';
import AlgorithmCompareVisualizer from '../components/lab/AlgorithmCompareVisualizer.jsx';

const LAB_MODULES = [
  {
    category: 'Database Design',
    items: [
      { id: 'er_designer', label: 'ER / EER Designer', icon: 'table', desc: 'Entities, cardinalities & SQL DDL mapping' },
      { id: 'normalization', label: 'Normalization Analyzer', icon: 'table', desc: 'Attribute closure X+, candidate keys & 1NF-BCNF' },
    ],
  },
  {
    category: 'Query Processing',
    items: [
      { id: 'query_trees', label: 'Query Tree Optimizer', icon: 'git-branch', desc: 'Relational algebra & selection pushdown' },
      { id: 'bplus_tree', label: 'B+ Tree Indexer', icon: 'database', desc: 'Order M balanced splits & leaf range scans' },
    ],
  },
  {
    category: 'Transactions & Concurrency',
    items: [
      { id: 'precedence', label: 'Precedence Graph', icon: 'git-branch', desc: 'Conflict serializability & topological order' },
      { id: 'compare', label: 'Algorithm Comparison', icon: 'sliders', desc: 'Detection vs Wait-Die vs Wound-Wait vs TO' },
    ],
  },
];

export default function LabPage({ toast, initialModule = 'er_designer', onBackToMaster }) {
  const [activeModule, setActiveModule] = useState(initialModule);

  // Sync if initialModule changes from outside
  useEffect(() => {
    if (initialModule) setActiveModule(initialModule);
  }, [initialModule]);

  return (
    <div className="lab-page" style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Category Navigation Bar */}
      <div
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: 24,
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="lab" size={20} color="var(--accent)" /> DBMS Laboratory Studio
            </h1>
            <p className="text-muted" style={{ margin: '2px 0 0 0', fontSize: 13 }}>
              Interactive workbench for Database Design, Query Processing, and Transaction Concurrency Control.
            </p>
          </div>
          {onBackToMaster && (
            <button className="btn btn-ghost" onClick={onBackToMaster} style={{ fontSize: 13 }}>
              &larr; Master Hub
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {LAB_MODULES.map((cat, idx) => (
            <div key={idx} style={{ background: 'var(--bg-sunken)', padding: 10, borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>
                {cat.category}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cat.items.map((item) => (
                  <button
                    key={item.id}
                    className={`btn ${activeModule === item.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => { setActiveModule(item.id); toast?.(`Switched to ${item.label}`); }}
                    style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '6px 10px', height: 'auto' }}
                  >
                    <Icon name={item.icon} size={15} style={{ marginRight: 6 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 400 }}>{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Lab Component */}
      <div>
        {activeModule === 'er_designer' && <ErDesignerVisualizer toast={toast} />}
        {activeModule === 'normalization' && <NormalizationVisualizer toast={toast} />}
        {activeModule === 'query_trees' && <QueryOptimizerVisualizer toast={toast} />}
        {activeModule === 'bplus_tree' && <BPlusTreeVisualizer toast={toast} />}
        {activeModule === 'precedence' && <PrecedenceVisualizer toast={toast} />}
        {activeModule === 'compare' && <AlgorithmCompareVisualizer toast={toast} />}
      </div>
    </div>
  );
}
