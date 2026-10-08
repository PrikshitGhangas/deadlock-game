import { useEffect, useMemo, useRef, useState } from 'react';
import { answer, suggestedQuestions, summarizeForAi } from '../../engine/tutor.js';
import { api } from '../../api/client.js';
import SpeakButton from './SpeakButton.jsx';
import { Icon } from '../common/Icons.jsx';

/** Shared across all Tutor instances so the status is fetched once. */
let aiStatusPromise = null;
const getAiStatus = () => (aiStatusPromise ||= api.ai.status().catch(() => ({ enabled: false })));

/**
 * Tutor chat with two engines:
 *  - Offline: engine/tutor.js — deterministic, no network, no cost (always available)
 *  - AI: an LLM behind a free-tier key configured in server/.env (Gemini / Groq / OpenRouter / local)
 * `ctx` = { mode, result, currentStep, input, resources, levelTip }.
 */
export default function Tutor({ ctx, onSeek, simulationId = null }) {
  const [thread, setThread] = useState([]);
  const [q, setQ] = useState('');
  const [ai, setAi] = useState({ enabled: false });
  const [engine, setEngine] = useState('offline'); // 'offline' | 'ai'
  const [busy, setBusy] = useState(false);
  const threadRef = useRef(null);

  const suggestions = useMemo(() => suggestedQuestions(ctx), [ctx]);

  useEffect(() => { getAiStatus().then(setAi); }, []);
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [thread, busy]);
  // New simulation → new conversation
  useEffect(() => { setThread([]); }, [ctx.result]);

  const useAi = engine === 'ai' && ai.enabled;

  const ask = async (question) => {
    const text = question.trim();
    if (!text || busy) return;
    setQ('');
    const offline = answer(text, ctx);
    setThread((t) => [...t, { role: 'user', text }]);

    if (!useAi) {
      setThread((t) => [...t, { role: 'bot', text: offline.answer, stepRef: offline.stepRef, intent: offline.intent, engine: 'offline' }]);
      api.tutorLog({ simulationId, mode: ctx.mode, question: text, intent: offline.intent, answer: offline.answer });
      return;
    }

    setBusy(true);
    try {
      const history = thread.filter((m) => m.role === 'user' || m.engine === 'ai').slice(-6)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      const res = await api.ai.ask({
        question: text,
        context: summarizeForAi(ctx),
        offlineAnswer: offline.intent === 'fallback' ? '' : offline.answer,
        history,
        mode: ctx.mode,
        simulationId,
      });
      const stepMatch = /\bstep (\d+)\b/i.exec(res.answer);
      const steps = ctx.result?.steps?.length || 0;
      const stepRef = stepMatch && Number(stepMatch[1]) >= 1 && Number(stepMatch[1]) <= steps ? Number(stepMatch[1]) - 1 : offline.stepRef;
      setThread((t) => [...t, { role: 'bot', text: res.answer, stepRef, engine: 'ai', model: res.model }]);
    } catch (e) {
      setThread((t) => [...t, { role: 'bot', text: `${e.message}\n\nOffline tutor says: ${offline.answer}`, stepRef: offline.stepRef, engine: 'offline', error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tutor">
      <div className="tutor-engines" role="radiogroup" aria-label="Tutor engine">
        <button type="button" className={`seg ${engine === 'offline' ? 'on' : ''}`} role="radio" aria-checked={engine === 'offline'} onClick={() => setEngine('offline')}>
          <Icon name="offline" size={13} style={{ marginRight: 6 }} /> Offline tutor
        </button>
        <button type="button" className={`seg ${engine === 'ai' ? 'on' : ''}`} role="radio" aria-checked={engine === 'ai'} onClick={() => setEngine('ai')}
          title={ai.enabled ? `${ai.provider} · ${ai.model}` : 'Add AI_PROVIDER and AI_API_KEY to server/.env to enable'}>
          <Icon name="sparkles" size={13} style={{ marginRight: 6 }} /> AI tutor{ai.enabled ? '' : ' (setup needed)'}
        </button>
      </div>
      {engine === 'ai' && !ai.enabled && (
        <div className="msg msg-info" style={{ fontSize: 12 }}>
          The AI tutor needs a free API key. Copy <code>server/.env.example</code> to <code>server/.env</code>, paste a Gemini / Groq / OpenRouter key, and restart <code>npm run dev</code>. The offline tutor keeps working meanwhile.
        </div>
      )}

      <div className="thread" ref={threadRef} aria-live="polite" aria-label="Tutor conversation">
        {thread.length === 0 && (
          <div className="bubble bubble-bot">
            {useAi
              ? <>Hi! I'm the AI tutor ({ai.model}). I can see the current simulation and will explain it in my own words — ask me anything about locks, waits, cycles or the algorithm. Facts are checked against the offline engine.</>
              : <>Hi! I'm the built-in tutor. Ask me about this run — who is waiting for whom, why a transaction was aborted, what a step means, or what would happen under another strategy. I work fully offline.</>}
          </div>
        )}
        {thread.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role} ${m.engine === 'ai' ? 'bubble-ai' : ''}`}>
            {m.role === 'bot' && <div className="bubble-tag">{m.engine === 'ai' ? `AI · ${m.model || ai.model}` : m.error ? 'fallback to offline' : 'offline'}</div>}
            {m.text}
            {m.role === 'bot' && m.stepRef != null && onSeek && (
              <div><a href="#" className="jump" onClick={(e) => { e.preventDefault(); onSeek(m.stepRef); }}>→ Jump to step {m.stepRef + 1}</a></div>
            )}
            {m.role === 'bot' && <div style={{ marginTop: 4 }}><SpeakButton text={m.text} /></div>}
          </div>
        ))}
        {busy && <div className="bubble bubble-bot bubble-ai"><span className="spinner" /> thinking…</div>}
      </div>

      <div>
        <div className="help" style={{ marginBottom: 6 }}>Try asking:</div>
        <div className="suggestions" aria-label="Suggested questions">
          {suggestions.map((s) => <button key={s} type="button" className="chip chip-btn" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={useAi ? 'Ask the AI tutor…' : 'Ask the tutor…'} aria-label="Question for the tutor" disabled={busy} />
        <button className="btn btn-primary" type="submit" disabled={!q.trim() || busy}>Ask</button>
      </form>
    </div>
  );
}
