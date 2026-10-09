import { Icon } from '../common/Icons.jsx';

export const MODULE_NAMES = {
  master: 'Master Hub',
  lab_er: 'ER / EER Designer',
  lab_norm: 'Normalization Analyzer',
  lab_query: 'Query Tree Optimizer',
  lab_bplus: 'B+ Tree Indexer',
  lab_precedence: 'Conflict Serializability',
  lab_compare: 'Algorithm Comparison',
  lab: 'DBMS Lab Studio',
  detection: 'Deadlock Detection (2PL)',
  prevention: 'Deadlock Prevention',
  bankers: "Banker's Algorithm",
  history: 'Run History',
  theory: 'Theory Guide',
  innovation: 'Innovations',
  about: 'Developed By',
};

export const TABS = Object.keys(MODULE_NAMES).map(id => ({ id, label: MODULE_NAMES[id] }));

export default function TopBar({ tab, onTab, theme, onTheme }) {
  const currentTitle = MODULE_NAMES[tab] || 'Master Hub';
  const isMaster = tab === 'master';

  return (
    <header className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px' }}>
      {/* Brand logo - clicking always returns to master */}
      <div
        className="brand"
        onClick={() => onTab('master')}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        role="button"
        tabIndex={0}
      >
        <span className="logo" aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--accent)' }}>
          <Icon name="database" size={22} />
        </span>
        <div>
          DBMS-Laboratory
          <small>Database Design · Query Processing · Transactions</small>
        </div>
      </div>

      {/* Central Navigation Indicator / Return to Master button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isMaster ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => onTab('master')}
              title="Return to Master Hub"
              style={{ fontWeight: 600 }}
            >
              &larr; Master Hub
            </button>
            <span style={{ color: 'var(--border-strong)' }}>/</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>
              {currentTitle}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="badge"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              Master Workbench
            </span>
          </div>
        )}
      </div>

      {/* Right Actions: Return to Hub if away + Theme toggle */}
      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!isMaster && (
          <button className="btn btn-sm btn-ghost" onClick={() => onTab('master')} style={{ fontSize: 12 }}>
            Master Hub
          </button>
        )}
        <button
          className="btn btn-icon"
          onClick={onTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title="Toggle theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </div>
    </header>
  );
}
