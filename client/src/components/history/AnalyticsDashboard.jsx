/** Small dependency-free SVG charts over the analytics endpoint. */

function BarChart({ data, labelKey, valueKey, danger }) {
  const W = 320, H = 160, pad = 28;
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const bw = data.length ? (W - pad * 2) / data.length : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bar chart">
      <line x1={pad} y1={H - pad} x2={W - pad / 2} y2={H - pad} className="axis" />
      {data.map((d, i) => {
        const h = ((H - pad * 2) * d[valueKey]) / max;
        return (
          <g key={i}>
            <rect x={pad + i * bw + bw * 0.15} y={H - pad - h} width={bw * 0.7} height={h} rx={3} className={danger?.(d) ? 'bar bar-danger' : 'bar'} />
            <text x={pad + i * bw + bw / 2} y={H - pad + 14} textAnchor="middle">{String(d[labelKey]).slice(0, 10)}</text>
            <text x={pad + i * bw + bw / 2} y={H - pad - h - 4} textAnchor="middle">{d[valueKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ points }) {
  const W = 320, H = 160, pad = 28;
  if (!points.length) return <p className="empty">No games played yet.</p>;
  const max = Math.max(120, ...points.map((p) => p.score));
  const x = (i) => pad + (points.length === 1 ? 0 : ((W - pad * 2) * i) / (points.length - 1));
  const y = (v) => H - pad - ((H - pad * 2) * v) / max;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.score)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Score trend">
      <line x1={pad} y1={H - pad} x2={W - pad / 2} y2={H - pad} className="axis" />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} className="axis" />
      <text x={pad - 4} y={pad + 4} textAnchor="end">{max}</text>
      <text x={pad - 4} y={H - pad} textAnchor="end">0</text>
      <path d={d} className="line" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.score)} r={4} className={p.deadlocked ? 'dot dot-danger' : 'dot'}><title>{p.level}: {p.score}{p.deadlocked ? ' (deadlock)' : ''}</title></circle>)}
    </svg>
  );
}

export default function AnalyticsDashboard({ data }) {
  if (!data) return null;
  const { totals, byMode, scoreTrend, levelStats, tutor } = data;
  const dlSplit = [
    { label: 'no deadlock', n: byMode.reduce((a, m) => a + (m.runs - m.withDeadlock), 0) },
    { label: 'deadlock', n: byMode.reduce((a, m) => a + m.withDeadlock, 0) },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="scorecard">
        <div className="stat"><div className="v">{totals.runs}</div><div className="l">saved runs</div></div>
        <div className="stat"><div className="v">{totals.deadlocks}</div><div className="l">deadlocks found</div></div>
        <div className="stat"><div className="v">{Math.round(totals.avgSteps)}</div><div className="l">avg steps</div></div>
        <div className="stat"><div className="v">{levelStats.reduce((a, l) => a + l.attempts, 0)}</div><div className="l">games played</div></div>
      </div>
      <div className="charts">
        <div className="chart"><h3>Runs by mode</h3>{byMode.length ? <BarChart data={byMode} labelKey="mode" valueKey="runs" /> : <p className="empty">Save a run to see it here.</p>}</div>
        <div className="chart"><h3>Deadlock vs no deadlock</h3>{totals.runs ? <BarChart data={dlSplit} labelKey="label" valueKey="n" danger={(d) => d.label === 'deadlock'} /> : <p className="empty">No runs yet.</p>}</div>
        <div className="chart"><h3>Game score trend</h3><LineChart points={scoreTrend} /></div>
        <div className="chart"><h3>Best score per level</h3>{levelStats.length ? <BarChart data={levelStats} labelKey="level" valueKey="best" /> : <p className="empty">No games yet.</p>}</div>
      </div>
      {tutor.intents.length > 0 && (
        <div className="chart">
          <h3>Tutor — most asked topics</h3>
          <div className="inline-list">{tutor.intents.map((i) => <span key={i.intent} className="chip">{i.intent} × {i.n}</span>)}</div>
        </div>
      )}
    </div>
  );
}
