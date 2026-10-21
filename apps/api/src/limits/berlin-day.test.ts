import { describe, expect, it } from 'vitest';
import { startOfBerlinDay } from './berlin-day';

function start(now: string): string {
  return startOfBerlinDay(new Date(now)).toISOString();
}

describe('startOfBerlinDay', () => {
  it('returns Berlin midnight in summer time (UTC+2)', () => {
    expect(start('2026-07-15T10:00:00.000Z')).toBe('2026-07-14T22:00:00.000Z');
  });

  it('returns Berlin midnight in winter time (UTC+1)', () => {
    expect(start('2026-01-15T10:00:00.000Z')).toBe('2026-01-14T23:00:00.000Z');
  });

  it('starts the new day at Berlin midnight, before UTC midnight', () => {
    expect(start('2026-10-21T21:59:59.999Z')).toBe('2026-10-20T22:00:00.000Z');
    expect(start('2026-10-21T22:00:00.000Z')).toBe('2026-10-21T22:00:00.000Z');
    expect(start('2026-10-21T22:30:00.000Z')).toBe('2026-10-21T22:00:00.000Z');
  });

  it('uses the winter offset of midnight on the day summer time begins', () => {
    // 2026-03-29: clocks jump from 02:00 CET to 03:00 CEST.
    expect(start('2026-03-29T12:00:00.000Z')).toBe('2026-03-28T23:00:00.000Z');
  });

  it('uses the summer offset of midnight on the day summer time ends', () => {
    // 2026-10-25: clocks fall back from 03:00 CEST to 02:00 CET.
    expect(start('2026-10-25T12:00:00.000Z')).toBe('2026-10-24T22:00:00.000Z');
  });
});
