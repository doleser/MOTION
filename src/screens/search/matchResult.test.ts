import type {ChallengeResult} from '../../services/challenges';
import {
  formatAutoConfirm,
  formatEloDelta,
  getAutoConfirmAt,
  getMatchAction,
  getResultStage,
  type MatchActionInput,
} from './matchResult';

const ME = 'me';
const THEM = 'them';

function result(status: ChallengeResult['status'], reportedBy: string): ChallengeResult {
  return {gameId: 42, status, winnerId: ME, reportedBy};
}

describe('getResultStage', () => {
  it.each([
    ['no result yet', null, 'report'],
    ['I reported, still pending', result('pending', ME), 'waiting'],
    ['they reported, still pending', result('pending', THEM), 'confirm'],
    ['confirmed (whoever reported)', result('confirmed', THEM), 'result'],
    ['disputed', result('voided', ME), 'disputed'],
  ] as const)('%s → %s', (_name, r, expected) => {
    expect(getResultStage(r, ME)).toBe(expected);
  });
});

describe('auto-confirm countdown', () => {
  const reportedAt = new Date('2026-11-22T18:00:00Z');
  const hoursLater = (h: number) => new Date(reportedAt.getTime() + h * 60 * 60 * 1000);

  it('auto-confirms 24 hours after the report', () => {
    expect(getAutoConfirmAt(reportedAt)).toEqual(hoursLater(24));
  });

  it('rounds up, so it never says 0h while time is left', () => {
    expect(formatAutoConfirm(reportedAt, reportedAt)).toBe('Auto-confirms in 24h');
    expect(formatAutoConfirm(reportedAt, hoursLater(0.5))).toBe('Auto-confirms in 24h');
    expect(formatAutoConfirm(reportedAt, hoursLater(22.9))).toBe('Auto-confirms in 2h');
  });

  it('says "under an hour" in the last hour', () => {
    expect(formatAutoConfirm(reportedAt, hoursLater(23.5))).toBe('Auto-confirms in under an hour');
  });

  it('says "soon" once the time has passed (nothing confirms it yet)', () => {
    expect(formatAutoConfirm(reportedAt, hoursLater(24))).toBe('Auto-confirms soon');
    expect(formatAutoConfirm(reportedAt, hoursLater(30))).toBe('Auto-confirms soon');
  });
});

describe('formatEloDelta', () => {
  it('adds a plus sign to a gain', () => {
    expect(formatEloDelta({eloBefore: 1398, eloAfter: 1414})).toBe('+16');
  });

  it('keeps the minus sign of a loss', () => {
    expect(formatEloDelta({eloBefore: 1482, eloAfter: 1468})).toBe('-14');
  });

  it('shows 0 for no change', () => {
    expect(formatEloDelta({eloBefore: 1200, eloAfter: 1200})).toBe('0');
  });
});

describe('getMatchAction', () => {
  const startsAt = new Date('2026-11-22T18:00:00Z');
  const minutes = (m: number) => new Date(startsAt.getTime() + m * 60 * 1000);
  const match = (changes: Partial<MatchActionInput> = {}): MatchActionInput => ({
    ranked: true,
    hasResult: false,
    startsAt,
    durationMinutes: 60,
    youCheckedIn: true,
    opponentReady: true,
    ...changes,
  });

  it('asks me to check in first', () => {
    expect(getMatchAction(match({youCheckedIn: false, opponentReady: false}), minutes(-10))).toBe('check_in');
  });

  it('waits for the opponent once I am checked in', () => {
    expect(getMatchAction(match({opponentReady: false}), minutes(5))).toBe('waiting_for_opponent');
  });

  it('waits for the start time when both are here early', () => {
    expect(getMatchAction(match(), minutes(-1))).toBe('waiting_for_start');
  });

  it('starts a ranked match from the start time', () => {
    expect(getMatchAction(match(), minutes(0))).toBe('start_match');
    expect(getMatchAction(match(), minutes(59))).toBe('start_match');
  });

  it('has no button for a casual match once both are here, even before the start', () => {
    expect(getMatchAction(match({ranked: false}), minutes(-1))).toBe('casual_ready');
    expect(getMatchAction(match({ranked: false}), minutes(10))).toBe('casual_ready');
  });

  it('offers REPORT RESULT after a ranked match, without check-in, for 24 hours', () => {
    const away = match({youCheckedIn: false, opponentReady: false});
    expect(getMatchAction(away, minutes(60))).toBe('report_result');
    expect(getMatchAction(away, minutes(60 + 24 * 60))).toBe('report_result');
    expect(getMatchAction(away, minutes(60 + 24 * 60 + 1))).toBe('none');
  });

  it('has nothing to do after a casual match', () => {
    expect(getMatchAction(match({ranked: false}), minutes(90))).toBe('none');
  });

  it('shows VIEW RESULT once someone has reported, at any time', () => {
    expect(getMatchAction(match({hasResult: true}), minutes(30))).toBe('view_result');
    expect(getMatchAction(match({hasResult: true, youCheckedIn: false}), minutes(120))).toBe('view_result');
  });
});
