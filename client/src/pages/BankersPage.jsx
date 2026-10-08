import { useEffect, useMemo, useRef, useState } from 'react';
import { parseBankers } from '../engine/parser.js';
import { simulateBankers } from '../engine/bankers.js';
import { sampleById } from '../engine/samples.js';
import { useStepper } from '../hooks/useStepper.js';
import { readUrlParams, buildShareUrl } from '../hooks/useUrlState.js';
import BankersMatrixEditor from '../components/input/BankersMatrixEditor.jsx';
import BankersTrace from '../components/viz/BankersTrace.jsx';
import StepControls from '../components/viz/StepControls.jsx';
import StepExplanation from '../components/explain/StepExplanation.jsx';
import Tutor from '../components/explain/Tutor.jsx';
import ResultActions from '../components/layout/ResultActions.jsx';

const first = sampleById('bankers-safe');

export default function BankersPage({ toast, loadRequest, onLoaded, active = true }) {
  const [value, setValue] = useState({ ...first.input, request: { ...first.input.request } });
  const [sampleId, setSampleId] = useState(first.id);
  const [run, setRun] = useState(null);
  const pendingStep = useRef(null);

  const parsed = useMemo(() => parseBankers(value), [value]);
  const steps = run?.result?.steps || [];
  const stepper = useStepper(steps.length, active);
  const step = steps[stepper.index];
  const prevStep = steps[stepper.index - 1];

  const execute = (v = value, title = '') => {
    const p = parseBankers(v);
    if (!p.ok) return;
    const result = simulateBankers(p);
    setRun({ mode: 'bankers', title: title || `Banker's · ${p.n}×${p.m}`, input: { ...v }, result });
  };

  useEffect(() => {
    const q = readUrlParams();
    if (window.location.hash.replace('#', '') !== 'bankers' || !q.sample) return;
    const smp = sampleById(q.sample);
    if (smp?.mode === 'bankers') { pendingStep.current = q.step; pickSample(smp); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingStep.current != null && steps.length) { stepper.goTo(pendingStep.current); pendingStep.current = null; }
  }, [steps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loadRequest) return;
    const v = { available: '', max: '', allocation: '', request: { pid: 0, vector: '' }, ...loadRequest.input };
    setValue(v); setSampleId(''); execute(v, loadRequest.title); onLoaded?.();
  }, [loadRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickSample = (s) => { const v = { ...s.input, request: { ...(s.input.request || { pid: 0, vector: '' }) } }; setSampleId(s.id); setValue(v); execute(v, s.title); };
  const reset = () => { setValue({ available: '', max: '', allocation: '', request: { pid: 0, vector: '' } }); setRun(null); setSampleId(''); };

  const tutorCtx = useMemo(() => ({ mode: 'bankers', result: run?.result, currentStep: stepper.index, input: run?.input }), [run, stepper.index]);
  const sum = run?.result?.summary;

  return (
    <main className="workspace" aria-labelledby="tab-bankers">
      <section className="pane pane-input" aria-label="Input">
        <div className="pane-header"><h2>Input</h2><span className="chip">avoidance</span></div>
        <BankersMatrixEditor value={value} onChange={(v) => { setValue(v); setSampleId(''); }} parsed={parsed} onRun={() => execute()} onReset={reset} sampleId={sampleId} onSample={pickSample} />
      </section>

      <section className="pane pane-viz" aria-label="Visualization">
        <div className="pane-header"><h2>Visualization</h2><ResultActions run={run} toast={toast} shareUrl={run && sampleId ? buildShareUrl('bankers', {}, stepper.index, sampleId) : null} /></div>
        <div className="pane-body">
          {sum && (
            <>
              <div className="scorecard" style={{ marginBottom: 4 }} aria-label="Real-time execution metrics">
                <div className="stat">
                  <div className="v">{steps.length ? stepper.index + 1 : 0} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>/ {steps.length}</span></div>
                  <div className="l">Step Progress</div>
                </div>
                <div className="stat">
                  <div className="v" style={{ color: sum.safe ? 'var(--ok)' : 'var(--danger)' }}>{sum.safe ? 'SAFE' : 'UNSAFE'}</div>
                  <div className="l">State Safety</div>
                </div>
                <div className="stat">
                  <div className="v">{step?.finish ? step.finish.filter(Boolean).length : 0} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>/ {parsed.n || 0}</span></div>
                  <div className="l">Processes Finished</div>
                </div>
                <div className="stat">
                  <div className="v" style={{ color: 'var(--accent)' }}>{step?.work ? step.work.join(', ') : (parsed.available?.join(', ') || '—')}</div>
                  <div className="l">Available Work</div>
                </div>
              </div>

              <div className="inline-list" aria-label="Run summary" style={{ marginBottom: 8 }}>
                <span className={`chip ${sum.safe ? 'chip-committed' : 'chip-aborted'}`}>{sum.safe ? 'SAFE' : 'UNSAFE'}</span>
                {sum.safe && <span className="chip">⟨{sum.sequence.map((p) => 'P' + p).join(', ')}⟩</span>}
                {sum.request && <span className={`chip ${sum.request.granted ? 'chip-committed' : 'chip-aborted'}`}>P{sum.request.pid} request {sum.request.granted ? 'granted' : `denied (${sum.request.reason})`}</span>}
                <span className="chip">{steps.length} total steps</span>
              </div>
            </>
          )}
          <BankersTrace step={step} prevStep={prevStep} />
        </div>
        <StepControls stepper={stepper} />
      </section>

      <section className="pane pane-explain sticky" aria-label="Explanation">
        <div className="pane-header"><h2>Explanation</h2><span className="help">← → to step</span></div>
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
