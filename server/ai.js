/**
 * ai.js — optional LLM tutor behind a free-tier API key. Uses plain fetch (no SDKs).
 *
 * Configure with environment variables (put them in server/.env — see .env.example):
 *   AI_PROVIDER = gemini | groq | openrouter | openai-compatible
 *   AI_API_KEY  = your key
 *   AI_MODEL    = optional model override
 *   AI_BASE_URL = only for openai-compatible (e.g. a local Ollama/LM Studio server)
 *
 * Free keys: Gemini → https://aistudio.google.com/apikey · Groq → https://console.groq.com/keys
 *            OpenRouter → https://openrouter.ai/keys (use a model whose id ends in ":free")
 */

const DEFAULT_MODEL = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  'openai-compatible': 'llama3.2',
};

export const SYSTEM_PROMPT = `You are a friendly, precise DBMS tutor inside the "Deadlock Game" learning app.
The student is looking at a simulation of transaction deadlocks (lock-based concurrency control, wait-for graphs,
deadlock detection with DFS, wait-die / wound-wait prevention, or the Banker's algorithm).

You receive the ACTUAL simulation data below plus the answer of a deterministic rule engine. Rules:
- Ground every claim in the provided data; never invent transactions, locks or steps that are not there.
- Refer to steps by their number ("step 5") so the student can jump to them.
- Explain the *why* in textbook terms (Coffman conditions, 2PL, timestamps, safe state, cycle in the WFG).
- Be concise: 2-6 short paragraphs or a short list. Use plain text, no markdown headings.
- If the question is unrelated to databases, transactions or this simulation, politely steer back.`;

export function aiConfig(env = process.env) {
  const provider = String(env.AI_PROVIDER || '').toLowerCase().trim();
  const apiKey = env.AI_API_KEY || '';
  if (!provider || (!apiKey && provider !== 'openai-compatible')) return { enabled: false };
  if (!DEFAULT_MODEL[provider]) return { enabled: false, error: `Unknown AI_PROVIDER "${provider}"` };
  return {
    enabled: true,
    provider,
    apiKey,
    model: env.AI_MODEL || DEFAULT_MODEL[provider],
    baseUrl: env.AI_BASE_URL || '',
  };
}

/** Public view of the config (never exposes the key). */
export function aiStatus(env = process.env) {
  const c = aiConfig(env);
  return c.enabled ? { enabled: true, provider: c.provider, model: c.model } : { enabled: false, error: c.error };
}

/**
 * Build the provider request for a chat turn.
 * @param {object} cfg from aiConfig
 * @param {{system:string, history:{role:'user'|'assistant', content:string}[]}} chat
 * @returns {{url:string, init:RequestInit, parse:(json:any)=>string}}
 */
export function buildRequest(cfg, chat) {
  if (cfg.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const body = {
      systemInstruction: { parts: [{ text: chat.system }] },
      contents: chat.history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    };
    return {
      url,
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      parse: (j) => (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim(),
    };
  }
  // OpenAI-compatible chat completions (Groq, OpenRouter, Ollama, LM Studio, …)
  const base = cfg.provider === 'groq' ? 'https://api.groq.com/openai/v1'
    : cfg.provider === 'openrouter' ? 'https://openrouter.ai/api/v1'
      : (cfg.baseUrl || 'http://localhost:11434/v1').replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === 'openrouter') { headers['HTTP-Referer'] = 'http://localhost:5173'; headers['X-Title'] = 'Deadlock Game'; }
  const body = {
    model: cfg.model,
    temperature: 0.4,
    max_tokens: 1024,
    messages: [{ role: 'system', content: chat.system }, ...chat.history],
  };
  return {
    url: `${base}/chat/completions`,
    init: { method: 'POST', headers, body: JSON.stringify(body) },
    parse: (j) => (j.choices?.[0]?.message?.content || '').trim(),
  };
}

/** Turn provider HTTP errors into student-friendly messages. */
export function friendlyError(status, detail = '') {
  if (status === 401 || status === 403) return 'The AI provider rejected the API key. Check AI_API_KEY in server/.env.';
  if (status === 404) return 'The configured model was not found. Check AI_MODEL in server/.env.';
  if (status === 429) return 'Rate limit reached on the free tier — wait a minute and try again, or switch to the offline tutor.';
  if (status >= 500) return 'The AI provider is having trouble right now. Try again shortly or use the offline tutor.';
  return `AI request failed (${status})${detail ? `: ${detail.slice(0, 200)}` : ''}`;
}

/**
 * Ask the configured LLM. Throws Error with a friendly message on failure.
 * @param {object} cfg
 * @param {{system:string, history:object[]}} chat
 * @param {typeof fetch} [fetchImpl]
 */
export async function askLLM(cfg, chat, fetchImpl = fetch) {
  const { url, init, parse } = buildRequest(cfg, chat);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'The AI provider took too long to answer. Try again or use the offline tutor.' : `Cannot reach the AI provider (${e.message}).`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text).error?.message || text; } catch { /* keep raw */ }
    throw new Error(friendlyError(res.status, detail));
  }
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('The AI provider returned an unreadable response.'); }
  const answer = parse(json);
  if (!answer) throw new Error('The AI provider returned an empty answer (it may have been blocked by a safety filter).');
  return answer;
}
