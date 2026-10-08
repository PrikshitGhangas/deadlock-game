import { Icon } from '../common/Icons.jsx';

/** First / prev / play / next / last + scrubber + speed. */
export default function StepControls({ stepper }) {
  const { index, total, playing, speed, setSpeed, goTo, next, prev, first, last, toggle } = stepper;
  const disabled = total === 0;
  return (
    <div className="stepper" role="group" aria-label="Step controls">
      <div className="btn-group">
        <button className="btn btn-icon" onClick={first} disabled={disabled || index === 0} title="First (Home)" aria-label="First step"><Icon name="first" size={14} /></button>
        <button className="btn btn-icon" onClick={prev} disabled={disabled || index === 0} title="Previous (←)" aria-label="Previous step"><Icon name="prev" size={14} /></button>
        <button className="btn btn-icon btn-primary" onClick={toggle} disabled={disabled || index >= total - 1} title="Play / pause (Space)" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Icon name="pause" size={14} /> : <Icon name="play" size={14} />}</button>
        <button className="btn btn-icon" onClick={next} disabled={disabled || index >= total - 1} title="Next (→)" aria-label="Next step"><Icon name="next" size={14} /></button>
        <button className="btn btn-icon" onClick={last} disabled={disabled || index >= total - 1} title="Last (End)" aria-label="Last step"><Icon name="last" size={14} /></button>
      </div>
      <span className="counter" aria-live="polite">Step {total ? index + 1 : 0} / {total}</span>
      <input type="range" min={0} max={Math.max(0, total - 1)} value={index} onChange={(e) => goTo(Number(e.target.value))} disabled={disabled} aria-label="Step scrubber" />
      <label className="speed">
        speed
        <input type="range" min={0.5} max={4} step={0.5} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Playback speed" />
        {speed}×
      </label>
    </div>
  );
}
