import { Icon } from '../common/Icons.jsx';

export const TABS = [
  { id: 'detection', label: 'Detection', icon: 'search' },
  { id: 'prevention', label: 'Prevention', icon: 'shield' },
  { id: 'bankers', label: "Banker's", icon: 'bank' },
  { id: 'lab', label: 'DBMS Lab', icon: 'lab' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'theory', label: 'Theory', icon: 'book' },
  { id: 'innovation', label: 'Innovation', icon: 'lightbulb' },
  { id: 'about', label: 'Developed By', icon: 'users' },
];

export default function TopBar({ tab, onTab, theme, onTheme }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--accent)' }}>
          <Icon name="database" size={22} />
        </span>
        <div>
          DBMS-Laboratory
          <small>Database Design · Query Processing · Transactions</small>
        </div>
      </div>
      <nav className="tabs" role="tablist" aria-label="Modes">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)} id={`tab-${t.id}`}>
            <Icon name={t.icon} size={15} style={{ marginRight: 4 }} /> {t.label}
          </button>
        ))}
      </nav>
      <div className="topbar-actions">
        <button className="btn btn-icon" onClick={onTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      </div>
    </header>
  );
}
