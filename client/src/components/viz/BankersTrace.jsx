function Matrix({ title, rows, cols, currentRow, changedCells, rowLabel = (i) => `P${i}`, colLabel = (j) => `R${j}` }) {
  return (
    <div>
      <h4 style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--fg-muted)' }}>{title}</h4>
      <table className="data matrix" aria-label={title}>
        <thead><tr><th />{cols.map((_, j) => <th key={j}>{colLabel(j)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i === currentRow ? 'row-current' : ''}>
              <th>{rowLabel(i)}</th>
              {r.map((v, j) => <td key={j} className={changedCells?.has(`${i},${j}`) ? 'cell-changed' : ''}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Vector({ title, values, changed }) {
  return (
    <div>
      <h4 style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--fg-muted)' }}>{title}</h4>
      <table className="data matrix" aria-label={title}>
        <tbody><tr>{values.map((v, j) => <td key={j} className={changed?.has(j) ? 'cell-changed' : ''}>{v}</td>)}</tr></tbody>
      </table>
    </div>
  );
}

/** Available / Max / Allocation / Need matrices plus Work & Finish for the current Banker's step. */
export default function BankersTrace({ step, prevStep }) {
  if (!step?.state) return <p className="empty">Enter the matrices and press Run to trace the Banker's algorithm.</p>;
  const st = step.state;
  const m = st.available.length;
  const cols = Array.from({ length: m });
  const pid = step.meta?.pid;

  const changedWork = new Set();
  if (prevStep?.state?.work && st.work) st.work.forEach((v, j) => { if (v !== prevStep.state.work[j]) changedWork.add(j); });
  const changedAlloc = new Set();
  if (prevStep?.state?.allocation) st.allocation.forEach((r, i) => r.forEach((v, j) => { if (v !== prevStep.state.allocation[i]?.[j]) changedAlloc.add(`${i},${j}`); }));
  const changedNeed = new Set();
  if (prevStep?.state?.need) st.need.forEach((r, i) => r.forEach((v, j) => { if (v !== prevStep.state.need[i]?.[j]) changedNeed.add(`${i},${j}`); }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Vector title="Available" values={st.available} />
        {st.work && <Vector title="Work" values={st.work} changed={changedWork} />}
        {st.finish && (
          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--fg-muted)' }}>Finish</h4>
            <table className="data matrix" aria-label="Finish vector">
              <tbody><tr>{st.finish.map((f, i) => <td key={i} className={f ? 'cell-true' : 'cell-false'} title={`P${i}`}>{f ? 'T' : 'F'}</td>)}</tr></tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Matrix title="Max" rows={st.max} cols={cols} currentRow={pid} />
        <Matrix title="Allocation" rows={st.allocation} cols={cols} currentRow={pid} changedCells={changedAlloc} />
        <Matrix title="Need = Max − Allocation" rows={st.need} cols={cols} currentRow={pid} changedCells={changedNeed} />
      </div>
      {st.sequence?.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--fg-muted)' }}>Safe sequence so far</h4>
          <div className="inline-list">{st.sequence.map((p, i) => <span key={i} className="chip chip-committed">P{p}</span>)}</div>
        </div>
      )}
    </div>
  );
}
