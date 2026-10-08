import { useEffect, useMemo, useRef, useState } from 'react';
import { parseSchedule } from '../engine/parser.js';
import { simulateDetection } from '../engine/detection.js';
import { simulatePrevention } from '../engine/prevention.js';
import { sampleById } from '../engine/samples.js';
import { useStepper } from '../hooks/useStepper.js';
import { readUrlParams, buildShareUrl } from '../hooks/useUrlState.js';
import ScheduleEditor from '../components/input/ScheduleEditor.jsx';
import WaitForGraph from '../components/viz/WaitForGraph.jsx';
import LockTable from '../components/viz/LockTable.jsx';
import Timeline from '../components/viz/Timeline.jsx';
import StepControls from '../components/viz/StepControls.jsx';
import StepExplanation from '../components/explain/StepExplanation.jsx';
import Tutor from '../components/explain/Tutor.jsx';
import ResultActions from '../components/layout/ResultActions.jsx';

const DEFAULT = {
  detection: { schedule: sampleById('classic-2').input.schedule, options: { victimPolicy: 'youngest' } },
  prevention: { schedule: sampleById('prevention-compare').input.schedule, options: { scheme: 'wait-die' } },
};

/**
 * Detection and Prevention share this page; `mode` selects the simulator.
 * `loadRequest` = { input, title } pushed from History to reload a run.
 */
export default function SimulatorPage({ mode, theme, toast, loadRequest, onLoaded, active = true }) {
  const [schedule, setSchedule] = useState(DEFAULT[mode].schedule);
  const [options, setOptions] = useState(DEFAULT[mode].options);
  const [sampleId, setSampleId] = useState(mode === 'detection' ? 'classic-2' : 'prevention-compare');
  const [run, setRun] = useState(null); // { mode, title, input, result }
  const [elapsed, setElapsed] = useState(null);
  const pendingStep = useRef(null);

  const parsed = useMemo(() => parseSchedule(schedule), [schedule]);
  const steps = run?.result?.steps || [];
  const stepper = useStepper(steps.length, active);
  const step = steps[stepper.index];
  const txns = run?.result?.txns || parsed.txns;

  const execute = (sched = schedule, opts = options, title = '') => {
    const p = parseSchedule(sched);
    if (!p.ok) return;
    const t0 = performance.now();
    const result = mode === 'detection' ? simulateDetection(p.ops, p.txns, opts) : simulatePrevention(p.ops, p.txns, opts);
    setElapsed(Math.round(performance.now() - t0));
    setRun({ mode, title: title || (mode === 'detection' ? `Detection · ${opts.victimPolicy}` : `Prevention · ${opts.scheme}`), input: { schedule: sched, ...opts }, result });
  };

  // deep link (?sample=…&step=… or ?s=<base64>) — only for the tab named in the hash
  useEffect(() => {
    const q = readUrlParams();
    if (window.location.hash.replace('#', '') !== mode) return;
    const opts = mode === 'detection' ? { victimPolicy: q.policy || 'youngest' } : { scheme: q.scheme || 'wait-die' };
    if (q.sample) {
      const smp = sampleById(q.sample);
      if (smp?.input.schedule) { setSampleId(smp.id); setSchedule(smp.input.schedule); setOptions(opts); pendingStep.current = q.step; execute(smp.input.schedule, opts, smp.title); }
    } else if (q.schedule) {
      setSampleId(''); setSchedule(q.schedule); setOptions(opts); pendingStep.current = q.step; execute(q.schedule, opts);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingStep.current != null && steps.length) { stepper.goTo(pendingStep.current); pendingStep.current = null; }
  }, [steps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // load from history / import
  useEffect(() => {
    if (!loadRequest) return;
    const { input, title } = loadRequest;
    const sched = input.schedule || '';
    const opts = mode === 'detection' ? { victimPolicy: input.victimPolicy || 'youngest' } : { scheme: input.scheme || 'wait-die' };
    setSchedule(sched);
    setOptions(opts);
    setSampleId('');
    execute(sched, opts, title);
    onLoaded?.();
  }, [loadRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickSample = (s) => {
    setSampleId(s.id);
    setSchedule(s.input.schedule);
    const opts = mode === 'detection' ? { victimPolicy: s.input.victimPolicy || 'youngest' } : { scheme: s.input.scheme || options.scheme };
    setOptions(opts);
    execute(s.input.schedule, opts, s.title);
  };

  const reset = () => { setSchedule(''); setRun(null); setSampleId(''); setElapsed(null); };

  const onImport = (imported, err) => {
    if (err) { toast(err); return; }
    if (imported.mode !== mode) toast(`Note: this file was exported from ${imported.mode} mode`);
    const opts = mode === 'detection' ? { victimPolicy: imported.input.victimPolicy || 'youngest' } : { scheme: imported.input.scheme || 'wait-die' };
    setSchedule(imported.input.schedule || '');
    setOptions(opts);
    setSampleId('');
    execute(imported.input.schedule || '', opts, imported.title);
    toast('Imported');
  };

  const tutorCtx = useMemo(() => ({ mode, result: run?.result, currentStep: stepper.index, input: run?.input, resources: parsed.resources }), [mode, run, stepper.index, parsed.resources]);
  const summary = run?.result?.summary;

  return (
    <main className="workspace" aria-labelledby={`tab-${mode}`}>
      <section className="pane pane-input" aria-label="Input">
        <div className="pane-header"><h2>Input</h2><span className="chip">{mode}</span></div>
        <ScheduleEditor
          mode={mode} value={schedule} onChange={(v) => { setSchedule(v); setSampleId(''); }} parsed={parsed}
          options={options} onOptions={(o) => { setOptions(o); if (run) execute(schedule, o); }}
          onRun={() => execute()} onReset={reset} onImport={onImport} sampleId={sampleId} onSample={pickSample}
        />
      </section>

      <section className="pane pane-viz" aria-label="Visualization">
        <div className="pane-header">
          <h2>Visualization</h2>
          <ResultActions run={run} toast={toast} shareUrl={run ? buildShareUrl(mode, run.input, stepper.index, sampleId) : null} />
        </div>
        <div className="pane-body">
          {summary && (
            <>
              <div className="scorecard" style={{ marginBottom: 4 }} aria-label="Real-time execution metrics">
                <div className="stat">
                  <div className="v">{steps.length ? stepper.index + 1 : 0} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>/ {steps.length}</span></div>
                  <div className="l">Step Progress</div>
                </div>
                <div className="stat">
                  <div className="v" style={{ color: 'var(--ok)' }}>{Object.values(step?.statuses || {}).filter(s => s === 'active' || s === 'committed').length}</div>
                  <div className="l">Active / Granted</div>
                </div>
                <div className="stat">
                  <div className="v" style={{ color: step?.blocked?.length ? 'var(--warn)' : 'var(--fg)' }}>{step?.blocked?.length || 0}</div>
                  <div className="l">Waiting / Blocked</div>
                </div>
                <div className="stat">
                  <div className="v" style={{ color: (step?.aborted?.length || summary.deadlocks > 0) ? 'var(--danger)' : 'var(--fg)' }}>{summary.rollbacks}</div>
                  <div className="l">Total Rollbacks</div>
                </div>
                <div className="stat">
                  <div className="v">{Object.values(step?.lockTable || {}).reduce((acc, r) => acc + (r.holders?.length || 0), 0)}</div>
                  <div className="l">Locks Held</div>
                </div>
              </div>

              <div className="inline-list" aria-label="Run summary" style={{ marginBottom: 8 }}>
                <span className={`chip ${summary.deadlocks ? 'chip-aborted' : 'chip-committed'}`}>{summary.deadlocks} deadlock{summary.deadlocks === 1 ? '' : 's'}</span>
                <span className="chip">{summary.rollbacks} rollback{summary.rollbacks === 1 ? '' : 's'}</span>
                <span className="chip">{steps.length} total steps</span>
                {summary.stuck?.length > 0 && <span className="chip chip-blocked">stuck: {summary.stuck.join(', ')}</span>}
                {elapsed != null && <span className="chip chip-idle" title="Simulation time">{elapsed} ms</span>}
                {step?.statuses && Object.entries(step.statuses).map(([t, s]) => <span key={t} className={`chip chip-${s}`}>{t}: {s}{step.timestamps ? ` (TS ${step.timestamps[t]})` : ''}</span>)}
              </div>
            </>
          )}
          <WaitForGraph step={step} txns={txns} theme={theme} visible={active} />
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lock table</h3>
            <LockTable step={step} resources={parsed.resources} />
          </div>
          {steps.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline</h3>
              <Timeline steps={steps} txns={txns} current={stepper.index} onSeek={stepper.goTo} />
            </div>
          )}
        </div>
        <StepControls stepper={stepper} />
      </section>

      <section className="pane pane-explain sticky" aria-label="Explanation">
        <div className="pane-header"><h2>Explanation</h2><span className="help">← → to step · Space to play</span></div>
        <div className="pane-body">
          <StepExplanation steps={steps} index={stepper.index} onSeek={stepper.goTo} />
          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tutor</h3>
          <Tutor ctx={tutorCtx} onSeek={stepper.goTo} />
        </div>
      </section>
    </main>
  );
}
