import ValidationMessages from './ValidationMessages.jsx';
import SamplePicker from './SamplePicker.jsx';

/** Left pane for Banker's mode: Available / Max / Allocation text grids + optional request. */
export default function BankersMatrixEditor({ value, onChange, parsed, onRun, onReset, sampleId, onSample }) {
  const errors = parsed?.errors || [];
  const set = (k, v) => onChange({ ...value, [k]: v });
  const setReq = (k, v) => onChange({ ...value, request: { ...(value.request || { pid: 0, vector: '' }), [k]: v } });

  return (
    <div className="pane-body">
      <SamplePicker mode="bankers" value={sampleId} onPick={onSample} />
      <label className="field">
        <span>Available (one number per resource type)</span>
        <input type="text" value={value.available} onChange={(e) => set('available', e.target.value)} placeholder="3 3 2" aria-label="Available vector" />
      </label>
      <label className="field">
        <span>Max (one row per process)</span>
        <textarea value={value.max} onChange={(e) => set('max', e.target.value)} style={{ minHeight: 110 }} placeholder={'7 5 3\n3 2 2\n9 0 2\n2 2 2\n4 3 3'} spellCheck={false} />
      </label>
      <label className="field">
        <span>Allocation (one row per process)</span>
        <textarea value={value.allocation} onChange={(e) => set('allocation', e.target.value)} style={{ minHeight: 110 }} placeholder={'0 1 0\n2 0 0\n3 0 2\n2 1 1\n0 0 2'} spellCheck={false} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
        <label className="field">
          <span>Request by</span>
          <select value={value.request?.pid ?? 0} onChange={(e) => setReq('pid', Number(e.target.value))} aria-label="Requesting process">
            {Array.from({ length: Math.max(1, parsed?.n || 5) }, (_, i) => <option key={i} value={i}>P{i}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Request vector (optional)</span>
          <input type="text" value={value.request?.vector ?? ''} onChange={(e) => setReq('vector', e.target.value)} placeholder="1 0 2" aria-label="Request vector" />
        </label>
      </div>
      <p className="help">Need is computed as Max − Allocation. Leave the request empty to run only the safety algorithm.</p>
      <ValidationMessages errors={errors} ok={!!parsed?.ok} okText={`${parsed?.n} processes × ${parsed?.m} resource types — press Run.`} />
      <div className="btn-group">
        <button className="btn btn-primary" onClick={onRun} disabled={!parsed?.ok}>▶ Run Banker's algorithm</button>
        <button className="btn" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}
