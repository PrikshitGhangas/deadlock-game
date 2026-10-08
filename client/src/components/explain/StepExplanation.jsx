import { useEffect, useRef } from 'react';
import SpeakButton from './SpeakButton.jsx';

const TONE = {
  DEADLOCK_DETECTED: 'danger', VICTIM: 'danger', DIE: 'danger', ABORT: 'danger',
  BLOCK: 'warn', WAIT: 'warn', BANKER_SKIP: 'warn', BANKER_DENY: 'danger', BANKER_UNSAFE: 'danger',
  COMMIT: 'ok', BANKER_SAFE: 'ok', BANKER_GRANT: 'ok', END: 'ok',
  WOUND: 'purple', RESTART: 'purple',
};
const toneOf = (s) => (s.event === 'GAME_MOVE' ? { deadlock: 'danger', block: 'warn', won: 'ok', commit: 'ok' }[s.meta?.kind] || '' : TONE[s.event] || '');

/** Current step explanation + a clickable log of all steps. */
export default function StepExplanation({ steps = [], index = 0, onSeek }) {
  const step = steps[index];
  const logRef = useRef(null);

  useEffect(() => {
    // scroll only the log box (scrollIntoView would also scroll the page)
    const box = logRef.current;
    const el = box?.querySelector('.current');
    if (!box || !el) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + el.offsetHeight - box.clientHeight;
  }, [index]);

  if (!step) return <p className="empty">Run a simulation — every step will be explained here.</p>;
  const tone = toneOf(step);
  const speech = `${step.explanation.title}. ${step.explanation.text} ${step.explanation.why}`;

  return (
    <div className="explain">
      <div className={`banner ${tone ? `banner-${tone}` : ''}`} aria-live="polite" aria-atomic="true">
        Step {index + 1}: {step.explanation.title}
      </div>
      {step.op?.text && <p style={{ margin: '8px 0 4px' }}><code className="kbd">{step.op.text}</code></p>}
      <p style={{ marginTop: 8 }}>{step.explanation.text}</p>
      {step.explanation.why && <div className="why"><strong>Why it matters:</strong> {step.explanation.why}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><SpeakButton text={speech} /></div>

      <h4 style={{ margin: '14px 0 6px', fontSize: 13, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All steps</h4>
      <ul className="log" ref={logRef} aria-label="Step log">
        {steps.map((s) => {
          const t = toneOf(s);
          return (
            <li key={s.index} className={s.index === index ? 'current' : ''} onClick={() => onSeek?.(s.index)} onKeyDown={(e) => e.key === 'Enter' && onSeek?.(s.index)} tabIndex={0} role="button" aria-current={s.index === index ? 'step' : undefined}>
              <span className="n">{s.index + 1}</span>
              <span className={`ev ${t ? `ev-${t}` : ''}`}>{s.event === 'GAME_MOVE' ? s.meta.kind : s.event.replace(/_/g, ' ').replace(/^BANKER /, '')}</span>
              <span>{s.explanation.title}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
