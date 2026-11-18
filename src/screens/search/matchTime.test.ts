import {getMatchTiming} from './matchTime';

const MINUTE_MS = 60 * 1000;
const start = new Date('2026-11-22T18:00:00');

/** `minutes` after the start (negative for before). */
function at(minutes: number): Date {
  return new Date(start.getTime() + minutes * MINUTE_MS);
}

describe('getMatchTiming', () => {
  it('is later until 5 minutes before the start', () => {
    expect(getMatchTiming(start, 60, at(-60))).toBe('later');
    expect(getMatchTiming(start, 60, at(-5.1))).toBe('later');
  });

  it('is now from 5 minutes before the start', () => {
    expect(getMatchTiming(start, 60, at(-5))).toBe('now');
    expect(getMatchTiming(start, 60, at(0))).toBe('now');
  });

  it('stays now until the match length is up', () => {
    expect(getMatchTiming(start, 60, at(59))).toBe('now');
    expect(getMatchTiming(start, 15, at(14))).toBe('now');
  });

  it('is ended at the start + length and after', () => {
    expect(getMatchTiming(start, 60, at(60))).toBe('ended');
    expect(getMatchTiming(start, 15, at(15))).toBe('ended');
    expect(getMatchTiming(start, 60, at(24 * 60))).toBe('ended');
  });
});
