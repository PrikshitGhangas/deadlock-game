import { describe, it, expect } from 'vitest';
import { parseSchedule, parseBankers } from '../../client/src/engine/parser.js';

describe('parseSchedule', () => {
  it('parses lock-level syntax', () => {
    const p = parseSchedule('T1: LOCK-X(A)\nT1: LOCK-S(B)\nT1: UNLOCK(A)\nT1: COMMIT');
    expect(p.ok).toBe(true);
    expect(p.ops.map((o) => o.type)).toEqual(['LOCK', 'LOCK', 'UNLOCK', 'COMMIT']);
    expect(p.ops[0]).toMatchObject({ txn: 'T1', mode: 'X', res: 'A', text: 'T1: LOCK-X(A)' });
    expect(p.txns).toEqual(['T1']);
    expect(p.resources).toEqual(['A', 'B']);
  });

  it('translates SQL-ish statements to locks', () => {
    const p = parseSchedule('t1: select a\nT2: update B\nT1: read C\nT2: write D');
    expect(p.ok).toBe(true);
    expect(p.ops.map((o) => o.mode)).toEqual(['S', 'X', 'S', 'X']);
    expect(p.ops[0].sql).toBe('SELECT');
  });

  it('ignores comments and blank lines', () => {
    const p = parseSchedule('# comment\n\nT1: X(A) -- trailing\n');
    expect(p.ok).toBe(true);
    expect(p.ops).toHaveLength(1);
  });

  it('reports syntax errors with line numbers', () => {
    const p = parseSchedule('T1: LOCK-X(A)\nhello world\nT1: FOO(A)');
    expect(p.ok).toBe(false);
    expect(p.errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it('rejects unlock of a lock never requested', () => {
    const p = parseSchedule('T1: UNLOCK(A)');
    expect(p.ok).toBe(false);
    expect(p.errors[0].msg).toMatch(/never requested/);
  });

  it('rejects operations after commit', () => {
    const p = parseSchedule('T1: COMMIT\nT1: LOCK-X(A)');
    expect(p.ok).toBe(false);
    expect(p.errors[0].msg).toMatch(/already committed/);
  });

  it('rejects redundant lock requests', () => {
    const p = parseSchedule('T1: LOCK-X(A)\nT1: LOCK-S(A)');
    expect(p.ok).toBe(false);
  });

  it('rejects empty schedule', () => {
    expect(parseSchedule('').ok).toBe(false);
    expect(parseSchedule('# only comment').errors[0].msg).toMatch(/empty/);
  });

  it('limits number of transactions', () => {
    const text = Array.from({ length: 13 }, (_, i) => `T${i + 1}: LOCK-X(A)`).join('\n');
    expect(parseSchedule(text).errors.some((e) => /Too many transactions/.test(e.msg))).toBe(true);
  });
});

describe('parseBankers', () => {
  const good = { available: '3 3 2', max: '7 5 3\n3 2 2\n9 0 2\n2 2 2\n4 3 3', allocation: '0 1 0\n2 0 0\n3 0 2\n2 1 1\n0 0 2' };
  it('parses matrices and computes need', () => {
    const p = parseBankers(good);
    expect(p.ok).toBe(true);
    expect(p.n).toBe(5);
    expect(p.m).toBe(3);
    expect(p.need[0]).toEqual([7, 4, 3]);
  });
  it('rejects dimension mismatch', () => {
    expect(parseBankers({ ...good, allocation: '0 1 0\n2 0 0' }).ok).toBe(false);
    expect(parseBankers({ ...good, max: '7 5\n3 2 2\n9 0 2\n2 2 2\n4 3 3' }).errors[0].msg).toMatch(/expected 3/);
  });
  it('rejects allocation > max', () => {
    const p = parseBankers({ ...good, allocation: '8 1 0\n2 0 0\n3 0 2\n2 1 1\n0 0 2' });
    expect(p.ok).toBe(false);
    expect(p.errors[0].msg).toMatch(/exceeds its Max/);
  });
  it('validates request', () => {
    expect(parseBankers({ ...good, request: { pid: 9, vector: '1 0 0' } }).ok).toBe(false);
    expect(parseBankers({ ...good, request: { pid: 1, vector: '1 0' } }).ok).toBe(false);
    const p = parseBankers({ ...good, request: { pid: 1, vector: '1 0 2' } });
    expect(p.ok).toBe(true);
    expect(p.request).toEqual({ pid: 1, vector: [1, 0, 2] });
  });
});
