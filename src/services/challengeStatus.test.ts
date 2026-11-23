import {
  getInboxSection,
  isResultAwaitingAnswer,
  isResultAwaitingOpponent,
  isResultSettled,
  type ChallengeTiming,
} from './challengeStatus';

const ME = 'me';
const THEM = 'them';
const startsAt = new Date('2026-11-22T18:00:00Z');
const hours = (h: number) => new Date(startsAt.getTime() + h * 60 * 60 * 1000);

/** A confirmed 60 minute ranked match against THEM. */
function match(result: ChallengeTiming['result'] = null): ChallengeTiming {
  return {
    direction: 'outgoing',
    status: 'confirmed',
    startsAt,
    durationMinutes: 60,
    closedAt: null,
    result,
    opponent: {userId: THEM},
  };
}

const pendingFromThem = match({status: 'pending', reportedBy: THEM});
const pendingFromMe = match({status: 'pending', reportedBy: ME});
const confirmed = match({status: 'confirmed', reportedBy: ME});
const disputed = match({status: 'voided', reportedBy: THEM});

describe('result helpers', () => {
  it('spots a result waiting for my answer', () => {
    expect(isResultAwaitingAnswer(pendingFromThem)).toBe(true);
    expect(isResultAwaitingAnswer(pendingFromMe)).toBe(false);
    expect(isResultAwaitingAnswer(confirmed)).toBe(false);
  });

  it('spots a result I reported that is waiting for them', () => {
    expect(isResultAwaitingOpponent(pendingFromMe)).toBe(true);
    expect(isResultAwaitingOpponent(pendingFromThem)).toBe(false);
  });

  it('counts confirmed and disputed as settled, pending as not', () => {
    expect(isResultSettled(confirmed)).toBe(true);
    expect(isResultSettled(disputed)).toBe(true);
    expect(isResultSettled(pendingFromMe)).toBe(false);
    expect(isResultSettled(match())).toBe(false);
  });
});

describe('getInboxSection with a result', () => {
  it('puts a result waiting for my answer under NEEDS YOUR ANSWER, even days later', () => {
    expect(getInboxSection(pendingFromThem, hours(0.5))).toBe('needs_answer');
    expect(getInboxSection(pendingFromThem, hours(72))).toBe('needs_answer');
  });

  it('puts a result I reported under WAITING, even days later', () => {
    expect(getInboxSection(pendingFromMe, hours(0.5))).toBe('waiting');
    expect(getInboxSection(pendingFromMe, hours(72))).toBe('waiting');
  });

  it('moves a settled result to RECENT straight away, even before the match time is over', () => {
    expect(getInboxSection(confirmed, hours(0.5))).toBe('recent');
    expect(getInboxSection(disputed, hours(0.5))).toBe('recent');
  });

  it('hides a settled result 24 hours after the match ends', () => {
    expect(getInboxSection(confirmed, hours(24.9))).toBe('recent');
    expect(getInboxSection(confirmed, hours(25))).toBeNull();
  });

  it('leaves a match with no result where it was: UPCOMING until it ends', () => {
    expect(getInboxSection(match(), hours(0.5))).toBe('upcoming');
    expect(getInboxSection(match(), hours(2))).toBe('recent');
  });
});
