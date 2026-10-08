const KIND = {
  GRANT: 'grant', BLOCK: 'block', WAIT: 'wait', UNLOCK: 'unlock', COMMIT: 'commit', ABORT: 'abort',
  DIE: 'abort', WOUND: 'grant', VICTIM: 'abort', RESTART: 'restart', DEADLOCK_DETECTED: 'abort',
};
const SHORT = {
  GRANT: (s) => `${s.op.mode}${s.op.res}`, BLOCK: (s) => `⏳${s.op.res}`, WAIT: (s) => `⏳${s.op.res}`,
  UNLOCK: (s) => `U${s.op.res}`, COMMIT: () => 'C', ABORT: () => 'A', DIE: () => '✗', WOUND: (s) => `${s.op.mode}${s.op.res}`,
  VICTIM: () => '✗', RESTART: () => '↻', DEADLOCK_DETECTED: () => '⚠',
};

/** Per-transaction timeline: one cell per step in which the transaction acted. */
export default function Timeline({ steps = [], txns = [], current = 0, onSeek }) {
  if (!steps.length) return null;
  return (
    <div className="timeline" aria-label="Transaction timeline">
      {txns.map((t) => (
        <div className="row" key={t}>
          <div className="name">{t}</div>
          <div className="track">
            {steps.map((s) => {
              const mine = s.txn === t || (s.event === 'WOUND' && String(s.meta?.victim).includes(t)) || (s.event === 'DEADLOCK_DETECTED' && s.cycle?.includes(t));
              const kind = mine ? (s.event === 'WOUND' && s.txn !== t ? 'abort' : KIND[s.event] || '') : '';
              const label = mine ? (s.event === 'WOUND' && s.txn !== t ? '✗' : SHORT[s.event]?.(s) || '') : '';
              const cls = ['cell', kind, s.index === current ? 'current' : '', s.index > current ? 'future' : ''].join(' ');
              return (
                <button
                  type="button"
                  key={s.index}
                  className={cls}
                  onClick={() => onSeek?.(s.index)}
                  title={`Step ${s.index + 1}: ${s.explanation?.title || s.event}`}
                  aria-label={`Step ${s.index + 1}`}
                  style={{ border: mine ? undefined : '1px dashed var(--border)', background: mine ? undefined : 'transparent' }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
