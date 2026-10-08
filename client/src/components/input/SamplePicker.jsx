import { SAMPLES } from '../../engine/samples.js';

/** Dropdown of built-in scenarios filtered by mode. */
export default function SamplePicker({ mode, onPick, value = '' }) {
  const list = SAMPLES.filter((s) => (mode === 'prevention' ? s.mode !== 'bankers' : s.mode === mode));
  return (
    <label className="field">
      <span>Load a sample</span>
      <select value={value} onChange={(e) => { const s = list.find((x) => x.id === e.target.value); if (s) onPick(s); }} aria-label="Sample scenarios">
        <option value="">— choose a sample —</option>
        {list.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
    </label>
  );
}
