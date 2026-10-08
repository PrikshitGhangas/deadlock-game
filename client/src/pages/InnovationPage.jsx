import { PROJECT, INNOVATIONS } from '../developedBy.js';
import { Icon } from '../components/common/Icons.jsx';

const TRY = {
  'You are the scheduler': 'game',
  'Two tutors: offline + AI': 'detection',
  'Watch the algorithm think': 'detection',
  'One schedule, four strategies': 'prevention',
  'History, analytics and sharing': 'history',
};

export default function InnovationPage({ onTab }) {
  return (
    <main className="page" aria-labelledby="tab-innovation" style={{ maxWidth: 1000 }}>
      <section style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 8 }} aria-hidden="true">
          <Icon name="lightbulb" size={32} />
        </div>
        <h1 style={{ margin: '4px 0 8px', fontSize: 30 }}>What makes {PROJECT.title} different</h1>
        <p style={{ margin: '0 auto', maxWidth: 720, color: 'var(--fg-muted)', fontSize: 16 }}>
          Most deadlock demos show a static wait-for graph. Deadlock Game turns the topic into something you can
          play with, question, and replay — an interactive lab for detection, prevention and avoidance rather than a slide.
        </p>
      </section>

      <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {INNOVATIONS.map((i) => (
          <div className="card" key={i.title} style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-flex', padding: 8, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden="true">
                <Icon name={i.icon} size={20} />
              </span>
              <h3 style={{ fontSize: 18 }}>{i.title}</h3>
            </div>
            <p style={{ color: 'var(--fg)', flex: 1 }}>{i.text}</p>
            {TRY[i.title] && (
              <div><button className="btn btn-sm" onClick={() => onTab(TRY[i.title])}>Try it →</button></div>
            )}
          </div>
        ))}
      </div>

      <section style={{ marginTop: 32 }} aria-labelledby="compare-heading">
        <h2 id="compare-heading" style={{ fontSize: 20, margin: '0 0 12px', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>Compared with a typical classroom demo</h2>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Aspect</th><th>Typical demo</th><th>Deadlock Game</th></tr></thead>
            <tbody>
              <tr><td>Input</td><td>Fixed example</td><td>Any schedule, lock-level or SQL-style, validated line by line; Banker's matrices</td></tr>
              <tr><td>Detection</td><td>Final graph with the cycle marked</td><td>DFS replayed step by step; every wait, grant, victim and restart explained</td></tr>
              <tr><td>Strategies</td><td>One</td><td>Detection (4 victim policies), wait-die, wound-wait, Banker's — same input, side-by-side outcomes</td></tr>
              <tr><td>Student role</td><td>Watch</td><td>Play the scheduler; hints computed by exhaustive search; scores and levels</td></tr>
              <tr><td>Help</td><td>Textbook</td><td>Offline tutor that answers questions about the current run and re-simulates "what if"; optional LLM tutor (free-tier key) grounded in the same data</td></tr>
              <tr><td>Persistence</td><td>None</td><td>SQLite history, Markdown/JSON export & import, shareable deep links, analytics dashboard</td></tr>
              <tr><td>Accessibility</td><td>—</td><td>Read-aloud, keyboard stepping, shape + colour states, dark/light, phone-width layout</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
