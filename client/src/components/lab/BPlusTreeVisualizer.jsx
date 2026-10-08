import { useState, useMemo } from 'react';
import { BPlusTree } from '../../engine/bPlusTree.js';
import { Icon } from '../common/Icons.jsx';

const PRESET_SEQUENCES = [
  { name: 'Syllabus Default', keys: [10, 20, 5, 6, 12, 30, 7, 17] },
  { name: 'Ascending Order', keys: [1, 2, 3, 4, 5, 6, 7, 8] },
  { name: 'Student IDs', keys: [101, 105, 102, 110, 108, 115, 120] },
];

export default function BPlusTreeVisualizer({ toast }) {
  const [order, setOrder] = useState(3);
  const [keysList, setKeysList] = useState([10, 20, 5, 6, 12, 30, 7, 17]);
  const [newKey, setNewKey] = useState('');
  const [searchTarget, setSearchTarget] = useState(12);
  const [rangeLow, setRangeLow] = useState(6);
  const [rangeHigh, setRangeHigh] = useState(20);

  // Construct tree instance
  const { tree, hierarchy } = useMemo(() => {
    const bpt = new BPlusTree(order);
    keysList.forEach(k => bpt.insert(k));
    return { tree: bpt, hierarchy: bpt.toHierarchy() };
  }, [order, keysList]);

  // Search trace
  const searchResult = useMemo(() => {
    if (searchTarget === '' || searchTarget === null) return null;
    return tree.search(Number(searchTarget));
  }, [tree, searchTarget]);

  // Range query
  const rangeResult = useMemo(() => {
    if (rangeLow === '' || rangeHigh === '') return null;
    return tree.rangeSearch(Number(rangeLow), Number(rangeHigh));
  }, [tree, rangeLow, rangeHigh]);

  const handleInsert = (e) => {
    e.preventDefault();
    const val = Number(newKey);
    if (isNaN(val)) return;
    if (keysList.includes(val)) {
      toast?.(`Key ${val} is already present in the tree`);
      return;
    }
    setKeysList(prev => [...prev, val]);
    setNewKey('');
    toast?.(`Inserted key ${val} into B+ tree`);
  };

  const handleReset = () => {
    setKeysList([]);
    toast?.('Cleared tree');
  };

  return (
    <div className="lab-module">
      <div className="lab-header">
        <div>
          <h2>B+ Tree & Database Index Visualizer</h2>
          <p className="pane-lead">
            Explore physical storage indexing with dynamic order <em>M</em> B+ Trees.
            Witness balanced splits, key copy-up into internal index routers, and fast leaf range scans.
          </p>
        </div>
        <div className="lab-actions">
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            Tree Order (<em>M</em>):
            <select
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}
            >
              <option value={3}>M = 3 (Max 2 keys/node)</option>
              <option value={4}>M = 4 (Max 3 keys/node)</option>
              <option value={5}>M = 5 (Max 4 keys/node)</option>
            </select>
          </label>
        </div>
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>Presets:</span>
        {PRESET_SEQUENCES.map((p, idx) => (
          <button
            key={idx}
            className="btn btn-ghost btn-sm"
            onClick={() => { setKeysList([...p.keys]); toast?.(`Loaded preset: ${p.name}`); }}
          >
            {p.name}
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={handleReset}>Clear All</button>
      </div>

      {/* Controls row */}
      <div className="grid-2col" style={{ marginBottom: 16 }}>
        {/* Insert and Search box */}
        <div className="card">
          <div className="card-header">
            <h3>Insert & Search Operations</h3>
            <span className="badge badge-neutral">{keysList.length} Keys Indexed</span>
          </div>

          <form onSubmit={handleInsert} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              type="number"
              placeholder="Enter key to insert (e.g. 25)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            />
            <button type="submit" className="btn btn-primary">
              <Icon name="check" size={14} style={{ marginRight: 4 }} /> Insert Key
            </button>
          </form>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Search Key:</label>
            <input
              type="number"
              value={searchTarget}
              onChange={(e) => setSearchTarget(e.target.value)}
              style={{ width: 80, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            />
            {searchResult && (
              <span className={`badge ${searchResult.found ? 'badge-ok' : 'badge-danger'}`}>
                {searchResult.found ? `Found in ${searchResult.trace.length} hops` : 'Not Found'}
              </span>
            )}
          </div>

          {searchResult && (
            <div style={{ padding: 10, background: 'var(--bg-sunken)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Search Traversal Trace (O(log N)):</div>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {searchResult.trace.map((t, idx) => (
                  <li key={idx} style={{ marginBottom: 2 }}>{t.explanation}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Range scan box */}
        <div className="card">
          <div className="card-header">
            <h3>Leaf Node Range Query (Linked List Scan)</h3>
            <span className="badge badge-info">O(log N + K)</span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Range:</label>
            <input
              type="number"
              value={rangeLow}
              onChange={(e) => setRangeLow(e.target.value)}
              style={{ width: 70, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            />
            <span>to</span>
            <input
              type="number"
              value={rangeHigh}
              onChange={(e) => setRangeHigh(e.target.value)}
              style={{ width: 70, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>

          {rangeResult && (
            <div style={{ padding: 10, background: 'var(--ok-soft)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: 'var(--ok)' }}>
                Result Keys [{rangeResult.keys.join(', ')}] ({rangeResult.count} matching records)
              </div>
              <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                Traversed down to the initial leaf, then followed horizontal sibling pointers across {rangeResult.leavesVisited.length} leaf node(s).
              </p>
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-muted)' }}>
            <strong>Why B+ Trees?</strong> Unlike standard B-trees, all actual data records reside exclusively in leaf nodes. Internal nodes act purely as compact memory-friendly router keys, and leaves form a doubly linked list for efficient range queries.
          </div>
        </div>
      </div>

      {/* Visual Tree Hierarchy Renderer */}
      <div className="card">
        <div className="card-header">
          <h3>Visual Tree Structure</h3>
          <span className="badge badge-neutral">{hierarchy.levels.length} Level(s) Deep</span>
        </div>

        <div style={{ overflowX: 'auto', padding: '20px 10px', minHeight: 180, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
          {hierarchy.levels.map((level, lvlIdx) => (
            <div key={lvlIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 6 }}>
                {lvlIdx === 0 ? 'ROOT LEVEL' : lvlIdx === hierarchy.levels.length - 1 ? 'LEAF LEVEL (Chained)' : `INTERNAL LEVEL ${lvlIdx}`}
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {level.map((node) => (
                  <div
                    key={node.id}
                    style={{
                      border: node.isLeaf ? '2px solid var(--accent)' : '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      background: node.isLeaf ? 'var(--accent-soft)' : 'var(--bg-elev)',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: 'var(--shadow)',
                      minWidth: 90,
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6 }}>
                      {node.keys.map((k, kIdx) => (
                        <span
                          key={kIdx}
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            padding: '2px 6px',
                            background: 'var(--bg-elev)',
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                          }}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                    {node.isLeaf && node.nextId && (
                      <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13 }} title="Leaf Next Pointer">&rarr;</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
