import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AnalyticsDashboard from '../components/history/AnalyticsDashboard.jsx';
import { Icon } from '../components/common/Icons.jsx';

const MODE_ICON = { detection: 'search', prevention: 'shield', bankers: 'bank', game: 'game' };

/** Saved runs + analytics. `onLoad(run)` reopens a run in its mode's page. */
export default function HistoryPage({ onLoad, toast }) {
  const [runs, setRuns] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const refresh = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([api.history.list(), api.analytics()]);
      setRuns(r); setAnalytics(a); setError(null);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const remove = async (id) => { await api.history.remove(id); toast(`Deleted #${id}`); refresh(); };
  const clearAll = async () => { if (window.confirm('Delete all saved runs?')) { await api.history.clear(); refresh(); } };
  const load = async (id) => { const full = await api.history.get(id); onLoad(full); };

  const shown = (runs || []).filter((r) => filter === 'all' || r.mode === filter);

  return (
    <main className="page" aria-labelledby="tab-history">
      {error && <div className="msg msg-error">{error}</div>}
      <section style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 22 }}>Analytics</h1>
        <AnalyticsDashboard data={analytics} />
      </section>
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Saved runs {runs && <span className="chip">{runs.length}</span>}</h1>
          <div className="btn-group">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by mode" style={{ width: 'auto' }}>
              <option value="all">All modes</option><option value="detection">Detection</option><option value="prevention">Prevention</option><option value="bankers">Banker's</option><option value="game">Game</option>
            </select>
            <button className="btn btn-sm" onClick={refresh}><Icon name="restart" size={13} /> Refresh</button>
            <button className="btn btn-sm btn-danger" onClick={clearAll} disabled={!runs?.length}>Clear all</button>
          </div>
        </div>
        {runs === null && !error && <p className="empty"><span className="spinner" /> Loading…</p>}
        {runs && shown.length === 0 && <p className="empty">Nothing saved yet. Run a simulation and press “Save to history”.</p>}
        <div className="cards">
          {shown.map((r) => (
            <div className="card" key={r.id}>
              <div className="row">
                <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name={MODE_ICON[r.mode]} size={16} /> {r.title || r.mode}
                </h3>
                <span className="chip">#{r.id}</span>
              </div>
              <p>{r.summary}</p>
              <p style={{ fontSize: 12 }}>{r.steps} steps · {new Date(r.createdAt + 'Z').toLocaleString()}</p>
              <div className="btn-group">
                {r.mode !== 'game' && <button className="btn btn-sm btn-primary" onClick={() => load(r.id)}>Open</button>}
                <a className="btn btn-sm" href={api.history.exportUrl(r.id, 'md')} download>Report .md</a>
                <a className="btn btn-sm" href={api.history.exportUrl(r.id, 'json')} download>JSON</a>
                <button className="btn btn-sm btn-danger" onClick={() => remove(r.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
