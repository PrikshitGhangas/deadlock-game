import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { aiConfig, aiStatus, buildRequest, askLLM, friendlyError } from '../../server/ai.js';
import { openDatabase } from '../../server/db.js';
import { createApp } from '../../server/app.js';
import { summarizeForAi } from '../../client/src/engine/tutor.js';
import { parseSchedule } from '../../client/src/engine/parser.js';
import { simulateDetection } from '../../client/src/engine/detection.js';
import { sampleById } from '../../client/src/engine/samples.js';

describe('ai config', () => {
  it('is disabled without a provider/key and never leaks the key', () => {
    expect(aiConfig({}).enabled).toBe(false);
    expect(aiConfig({ AI_PROVIDER: 'gemini' }).enabled).toBe(false);
    expect(aiConfig({ AI_PROVIDER: 'nope', AI_API_KEY: 'k' })).toMatchObject({ enabled: false, error: expect.stringMatching(/Unknown/) });
    const s = aiStatus({ AI_PROVIDER: 'groq', AI_API_KEY: 'secret' });
    expect(s).toEqual({ enabled: true, provider: 'groq', model: 'llama-3.3-70b-versatile' });
    expect(JSON.stringify(s)).not.toMatch(/secret/);
  });

  it('local openai-compatible servers need no key', () => {
    const c = aiConfig({ AI_PROVIDER: 'openai-compatible', AI_BASE_URL: 'http://localhost:11434/v1' });
    expect(c.enabled).toBe(true);
    expect(buildRequest(c, { system: 's', history: [] }).url).toBe('http://localhost:11434/v1/chat/completions');
  });
});

describe('buildRequest', () => {
  const chat = { system: 'SYS', history: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }, { role: 'user', content: 'q' }] };

  it('gemini shape', () => {
    const r = buildRequest(aiConfig({ AI_PROVIDER: 'gemini', AI_API_KEY: 'K1' }), chat);
    expect(r.url).toMatch(/gemini-2\.5-flash:generateContent\?key=K1$/);
    const body = JSON.parse(r.init.body);
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
    expect(body.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(r.parse({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })).toBe('ab');
  });

  it('groq / openrouter use OpenAI chat completions with bearer auth', () => {
    const r = buildRequest(aiConfig({ AI_PROVIDER: 'groq', AI_API_KEY: 'K2', AI_MODEL: 'm' }), chat);
    expect(r.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(r.init.headers.Authorization).toBe('Bearer K2');
    const body = JSON.parse(r.init.body);
    expect(body.model).toBe('m');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(body.messages).toHaveLength(4);
    expect(r.parse({ choices: [{ message: { content: ' hello ' } }] })).toBe('hello');
    const o = buildRequest(aiConfig({ AI_PROVIDER: 'openrouter', AI_API_KEY: 'K3' }), chat);
    expect(o.url).toMatch(/openrouter\.ai/);
    expect(o.init.headers['X-Title']).toBe('Deadlock Game');
  });
});

describe('askLLM', () => {
  const cfg = aiConfig({ AI_PROVIDER: 'groq', AI_API_KEY: 'k' });
  const chat = { system: 's', history: [{ role: 'user', content: 'q' }] };
  const fake = (status, body) => async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

  it('returns the answer text', async () => {
    expect(await askLLM(cfg, chat, fake(200, { choices: [{ message: { content: 'Answer!' } }] }))).toBe('Answer!');
  });

  it('maps provider errors to friendly messages', async () => {
    await expect(askLLM(cfg, chat, fake(401, { error: { message: 'bad key' } }))).rejects.toThrow(/API key/);
    await expect(askLLM(cfg, chat, fake(429, {}))).rejects.toThrow(/Rate limit/);
    await expect(askLLM(cfg, chat, fake(200, { choices: [] }))).rejects.toThrow(/empty answer/);
    await expect(askLLM(cfg, chat, async () => { throw new Error('ECONNREFUSED'); })).rejects.toThrow(/Cannot reach/);
    expect(friendlyError(404)).toMatch(/model/);
  });
});

describe('/api/ai', () => {
  let app;
  const saved = { ...process.env };
  beforeAll(() => { app = createApp(openDatabase(':memory:')); });
  afterEach(() => { delete process.env.AI_PROVIDER; delete process.env.AI_API_KEY; Object.assign(process.env, saved); });

  it('reports not configured and refuses /ask with 503', async () => {
    delete process.env.AI_PROVIDER; delete process.env.AI_API_KEY;
    expect((await request(app).get('/api/ai/status')).body.enabled).toBe(false);
    const r = await request(app).post('/api/ai/ask').send({ question: 'hi' });
    expect(r.status).toBe(503);
    expect(r.body.enabled).toBe(false);
    expect((await request(app).get('/api/health')).body.ai.enabled).toBe(false);
  });

  it('validates the question when configured', async () => {
    process.env.AI_PROVIDER = 'groq'; process.env.AI_API_KEY = 'k';
    expect((await request(app).get('/api/ai/status')).body).toMatchObject({ enabled: true, provider: 'groq' });
    expect((await request(app).post('/api/ai/ask').send({})).status).toBe(400);
    expect((await request(app).post('/api/ai/ask').send({ question: 'x'.repeat(1001) })).status).toBe(400);
  });
});

describe('summarizeForAi', () => {
  it('describes the run compactly', () => {
    const s = sampleById('classic-2');
    const p = parseSchedule(s.input.schedule);
    const result = simulateDetection(p.ops, p.txns);
    const text = summarizeForAi({ mode: 'detection', input: s.input, result, currentStep: 4 });
    expect(text).toMatch(/Mode: detection/);
    expect(text).toMatch(/T1: LOCK-X\(A\)/);
    expect(text).toMatch(/Steps \(12\)/);
    expect(text).toMatch(/currently viewing step 5/);
    expect(text).toMatch(/Cycle: T1 -> T2 -> T1/);
    expect(text.length).toBeLessThan(4000);
    expect(summarizeForAi({ mode: 'game' })).toMatch(/No simulation/);
  });
});
