import { useRef } from 'react';
import ValidationMessages from './ValidationMessages.jsx';
import SamplePicker from './SamplePicker.jsx';
import { VICTIM_POLICIES } from '../../engine/explain.js';
import { fromJSON } from '../../engine/report.js';

/**
 * Left-pane editor for lock schedules (Detection & Prevention modes).
 * props: mode, value, onChange, parsed, options, onOptions, onRun, onReset, onImport(run), busy
 */
export default function ScheduleEditor({ mode, value, onChange, parsed, options, onOptions, onRun, onReset, onImport, sampleId, onSample }) {
  const fileRef = useRef(null);
  const errors = parsed?.errors || [];

  const importFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const run = fromJSON(await f.text());
      onImport(run);
    } catch (err) {
      onImport(null, err.message);
    }
    e.target.value = '';
  };

  return (
    <div className="pane-body">
      <SamplePicker mode={mode} value={sampleId} onPick={onSample} />

      <label className="field">
        <span>Schedule <small style={{ fontWeight: 400 }}>{parsed?.ok ? `${parsed.txns.length} txns · ${parsed.resources.length} items · ${parsed.ops.length} ops` : ''}</small></span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={errors.length ? 'has-error' : ''}
          aria-invalid={errors.length > 0}
          aria-describedby="schedule-help"
          placeholder={'T1: LOCK-X(A)\nT2: LOCK-X(B)\nT1: LOCK-X(B)\nT2: LOCK-X(A)\nT1: COMMIT\nT2: COMMIT'}
        />
      </label>
      <p className="help" id="schedule-help">
        One operation per line: <code>T1: LOCK-X(A)</code>, <code>T1: LOCK-S(B)</code>, <code>T1: UNLOCK(A)</code>, <code>T1: COMMIT</code>. SQL style works too: <code>T2: SELECT A</code> (shared) or <code>T2: UPDATE A</code> (exclusive). <code>#</code> starts a comment.
      </p>
      <ValidationMessages errors={errors} ok={!!parsed?.ok && value.trim() !== ''} okText="Schedule is valid — press Run." />

      {mode === 'detection' ? (
        <label className="field">
          <span>Victim selection policy</span>
          <select value={options.victimPolicy} onChange={(e) => onOptions({ ...options, victimPolicy: e.target.value })}>
            {Object.entries(VICTIM_POLICIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      ) : (
        <label className="field">
          <span>Prevention scheme</span>
          <select value={options.scheme} onChange={(e) => onOptions({ ...options, scheme: e.target.value })}>
            <option value="wait-die">Wait-die (non-preemptive)</option>
            <option value="wound-wait">Wound-wait (preemptive)</option>
          </select>
        </label>
      )}

      <div className="btn-group">
        <button className="btn btn-primary" onClick={onRun} disabled={!parsed?.ok}>▶ Run simulation</button>
        <button className="btn" onClick={onReset}>Reset</button>
        <button className="btn" onClick={() => fileRef.current?.click()} title="Import a JSON export">Import JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={importFile} className="sr-only" aria-label="Import JSON file" />
      </div>
    </div>
  );
}
