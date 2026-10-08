import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { openDatabase } from '../../server/db.js';
import { createApp } from '../../server/app.js';
import { parseSchedule } from '../../client/src/engine/parser.js';
import { simulateDetection } from '../../client/src/engine/detection.js';
import { sampleById } from '../../client/src/engine/samples.js';

let app;
beforeAll(() => {
  app = createApp(openDatabase(':memory:'));
});

const sample = sampleById('classic-2');
const parsed = parseSchedule(sample.input.schedule);
const result = simulateDetection(parsed.ops, parsed.txns);

describe('API', () => {
  it('health + samples', async () => {
    expect((await request(app).get('/api/health')).body.ok).toBe(true);
    const s = await request(app).get('/api/samples');
    expect(s.body.length).toBeGreaterThanOrEqual(5);
  });

  it('history round trip: POST → GET → export → DELETE', async () => {
    const post = await request(app).post('/api/history').send({ mode: 'detection', title: 'classic', input: sample.input, result });
    expect(post.status).toBe(201);
    expect(post.body.summary).toMatch(/1 deadlock/);
    const id = post.body.id;

    const list = await request(app).get('/api/history');
    expect(list.body[0].id).toBe(id);
    expect(list.body[0].input).toBeUndefined();

    const one = await request(app).get(`/api/history/${id}`);
    expect(one.body.result.steps.length).toBe(result.steps.length);

    const md = await request(app).get(`/api/history/${id}/export?format=md`);
    expect(md.headers['content-type']).toMatch(/markdown/);
    expect(md.text).toMatch(/# Deadlock Game report/);
    const js = await request(app).get(`/api/history/${id}/export`);
    expect(JSON.parse(js.text).app).toBe('deadlock-game');

    expect((await request(app).delete(`/api/history/${id}`)).body.ok).toBe(true);
    expect((await request(app).get(`/api/history/${id}`)).status).toBe(404);
  });

  it('validates history payloads', async () => {
    expect((await request(app).post('/api/history').send({ mode: 'nope' })).status).toBe(400);
    expect((await request(app).post('/api/history').send({ mode: 'detection', input: {} })).status).toBe(400);
    const bad = await request(app).post('/api/history').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
  });

  it('scores + analytics', async () => {
    expect((await request(app).post('/api/scores').send({ level: 'L1', score: 120, moves: 6 })).status).toBe(201);
    expect((await request(app).post('/api/scores').send({ level: 'L1', score: 0, moves: 4, deadlocked: true })).status).toBe(201);
    expect((await request(app).post('/api/scores').send({ level: 'L1', score: -1, moves: 4 })).status).toBe(400);
    const sc = await request(app).get('/api/scores');
    expect(sc.body.best[0]).toMatchObject({ level: 'L1', best: 120, attempts: 2 });

    await request(app).post('/api/tutor-log').send({ mode: 'detection', question: 'is there a deadlock', intent: 'cycle', answer: 'yes' });
    await request(app).post('/api/history').send({ mode: 'detection', title: 'again', input: sample.input, result });

    const a = await request(app).get('/api/analytics');
    expect(a.body.totals.runs).toBe(1);
    expect(a.body.byMode[0].mode).toBe('detection');
    expect(a.body.levelStats[0].attempts).toBe(2);
    expect(a.body.tutor.intents[0]).toEqual({ intent: 'cycle', n: 1 });
  });

  it('404 for unknown api routes', async () => {
    expect((await request(app).get('/api/nothing')).status).toBe(404);
  });
});
