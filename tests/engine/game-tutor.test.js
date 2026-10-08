import { describe, it, expect } from 'vitest';
import { answer, suggestedQuestions, GLOSSARY } from '../../client/src/engine/tutor.js';
import { parseSchedule } from '../../client/src/engine/parser.js';
import { simulateDetection } from '../../client/src/engine/detection.js';
import { simulateBankers } from '../../client/src/engine/bankers.js';
import { parseBankers } from '../../client/src/engine/parser.js';
import { sampleById } from '../../client/src/engine/samples.js';
import { toMarkdown, toJSON, fromJSON } from '../../client/src/engine/report.js';

describe('tutor', () => {
  const s = sampleById('classic-2');
  const p = parseSchedule(s.input.schedule);
  const result = simulateDetection(p.ops, p.txns, { victimPolicy: 'youngest' });
  const ctx = { mode: 'detection', input: s.input, result, resources: p.resources, currentStep: result.steps.length - 1 };

  it('answers "is there a deadlock"', () => {
    const a = answer('Is there a deadlock?', ctx);
    expect(a.intent).toBe('cycle');
    expect(a.answer).toMatch(/T1 → T2 → T1/);
    expect(a.stepRef).toBe(result.steps.findIndex((x) => x.event === 'DEADLOCK_DETECTED'));
  });

  it('answers "why was T2 aborted"', () => {
    const a = answer('why did T2 get rolled back?', ctx);
    expect(a.intent).toBe('whyVictim');
    expect(a.answer).toMatch(/youngest/);
  });

  it('answers who is waiting at a step', () => {
    const blockIdx = result.steps.findIndex((x) => x.event === 'BLOCK');
    const a = answer('who is T1 waiting for', { ...ctx, currentStep: blockIdx });
    expect(a.intent).toBe('waitingFor');
    expect(a.answer).toMatch(/T1 waits for T2/);
  });

  it('answers what-if by re-running the engine', () => {
    const a = answer('What if I used wound-wait instead?', ctx);
    expect(a.intent).toBe('whatIf');
    expect(a.answer).toMatch(/wound-wait/);
    expect(a.answer).toMatch(/aborted: T2/);
  });

  it('explains a numbered step', () => {
    const a = answer('explain step 3', ctx);
    expect(a.intent).toBe('explainStep');
    expect(a.stepRef).toBe(2);
  });

  it('defines glossary terms', () => {
    const a = answer('what is a wait-for graph?', ctx);
    expect(a.intent).toBe('define');
    expect(a.answer).toMatch(GLOSSARY['wait-for graph'].slice(0, 30));
    expect(answer('tell me about wound wait', ctx).answer).toMatch(/preemptive/);
  });

  it('handles bankers questions', () => {
    const b = sampleById('bankers-unsafe');
    const r = simulateBankers(parseBankers(b.input));
    const bctx = { mode: 'bankers', input: b.input, result: r };
    expect(answer('what is the safe sequence', bctx).answer).toMatch(/P1, P3, P4, P0, P2/);
    expect(answer('why was the request denied?', bctx).answer).toMatch(/unsafe/);
  });

  it('falls back gracefully and always offers suggestions', () => {
    const a = answer('banana', ctx);
    expect(a.intent).toBe('fallback');
    expect(a.suggestions.length).toBeGreaterThan(3);
    expect(suggestedQuestions({ mode: 'game', steps: [] }).length).toBeGreaterThan(0);
  });
});

describe('report', () => {
  const s = sampleById('classic-2');
  const p = parseSchedule(s.input.schedule);
  const result = simulateDetection(p.ops, p.txns);
  const run = { title: 'x', mode: 'detection', input: s.input, result };

  it('renders markdown with every step', () => {
    const md = toMarkdown(run);
    expect(md).toMatch(/# Deadlock Game report/);
    expect((md.match(/### Step /g) || []).length).toBe(result.steps.length);
    expect(md).toMatch(/Cycle:\*\* T1 → T2 → T1/);
  });

  it('round-trips JSON', () => {
    const back = fromJSON(toJSON(run));
    expect(back.mode).toBe('detection');
    expect(back.input.schedule).toBe(s.input.schedule);
    expect(() => fromJSON('{}')).toThrow(/Not a Deadlock Game/);
    expect(() => fromJSON('nope')).toThrow(/valid JSON/);
  });
});
