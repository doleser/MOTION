import {
  checkStartTime,
  getEarliestStart,
  getEndTime,
  getLatestStart,
  isAllowedMatchLength,
  MATCH_LENGTHS,
  matchesOverlap,
  roundDownToStep,
  roundUpToStep,
  toAllowedStart,
} from './challengeTime';

/** Nov 20, 2026 at hour:minute:second, phone time. */
function at(hour: number, minute: number, second = 0): Date {
  return new Date(2026, 10, 20, hour, minute, second);
}

/** A match starting at hour:minute that lasts `minutes`. */
function match(hour: number, minute: number, minutes: number) {
  return {startsAt: at(hour, minute), durationMinutes: minutes};
}

describe('matchesOverlap', () => {
  it('3:00 for 60 min and 4:00 for 60 min do NOT overlap (back to back)', () => {
    expect(matchesOverlap(match(15, 0, 60), match(16, 0, 60))).toBe(false);
  });

  it('3:00 for 60 min and 3:30 for 15 min DO overlap', () => {
    expect(matchesOverlap(match(15, 0, 60), match(15, 30, 15))).toBe(true);
  });

  it('3:00 for 15 min and 3:15 for 30 min do NOT overlap', () => {
    expect(matchesOverlap(match(15, 0, 15), match(15, 15, 30))).toBe(false);
  });

  it('3:00 for 45 min and 3:40 for 15 min DO overlap', () => {
    expect(matchesOverlap(match(15, 0, 45), match(15, 40, 15))).toBe(true);
  });

  it('a match that starts before another and ends during it overlaps', () => {
    // 2:30-3:30 runs into 3:00-4:00.
    expect(matchesOverlap(match(14, 30, 60), match(15, 0, 60))).toBe(true);
  });

  it('gives the same answer in either order', () => {
    expect(matchesOverlap(match(15, 30, 15), match(15, 0, 60))).toBe(true);
    expect(matchesOverlap(match(16, 0, 60), match(15, 0, 60))).toBe(false);
  });

  it('overlaps when one match is entirely inside the other', () => {
    expect(matchesOverlap(match(15, 0, 60), match(15, 15, 15))).toBe(true);
  });

  it('overlaps when both start at the same time', () => {
    expect(matchesOverlap(match(15, 0, 15), match(15, 0, 60))).toBe(true);
  });

  it("doesn't overlap when one ends well before the other starts", () => {
    expect(matchesOverlap(match(13, 0, 30), match(15, 0, 60))).toBe(false);
  });

  // The fake accepted match in challenges.ts: 6:00 PM for 45 min.
  it('matches the phone-test cases for the fake 6:00-6:45 PM match', () => {
    const fake = match(18, 0, 45);
    expect(matchesOverlap(fake, match(17, 15, 45))).toBe(false); // ends 6:00
    expect(matchesOverlap(fake, match(17, 30, 45))).toBe(true); // ends 6:15
    expect(matchesOverlap(fake, match(18, 30, 15))).toBe(true);
    expect(matchesOverlap(fake, match(18, 45, 60))).toBe(false); // starts 6:45
  });
});

describe('getEndTime', () => {
  it('adds the length to the start', () => {
    expect(getEndTime(match(15, 0, 45))).toEqual(at(15, 45));
    expect(getEndTime(match(23, 30, 60))).toEqual(new Date(2026, 10, 21, 0, 30));
  });
});

describe('MATCH_LENGTHS / isAllowedMatchLength', () => {
  it('defaults to 60 minutes', () => {
    expect(MATCH_LENGTHS.defaultMinutes).toBe(60);
  });

  it('allows 15, 30, 45, and 60', () => {
    for (const minutes of [15, 30, 45, 60]) {
      expect(isAllowedMatchLength(minutes)).toBe(true);
    }
  });

  it('refuses anything else', () => {
    for (const minutes of [0, 10, 20, 50, 90, -15, 15.5]) {
      expect(isAllowedMatchLength(minutes)).toBe(false);
    }
  });
});

describe('roundUpToStep', () => {
  it('rounds up to the next 15 minutes', () => {
    expect(roundUpToStep(at(17, 52))).toEqual(at(18, 0));
    expect(roundUpToStep(at(17, 31))).toEqual(at(17, 45));
  });

  it('keeps a time already on a step', () => {
    expect(roundUpToStep(at(18, 15))).toEqual(at(18, 15));
  });

  it('moves a step time with seconds to the next step', () => {
    expect(roundUpToStep(at(17, 45, 30))).toEqual(at(18, 0));
  });

  it('rolls over to the next hour and day', () => {
    expect(roundUpToStep(at(23, 50))).toEqual(new Date(2026, 10, 21, 0, 0));
  });
});

describe('roundDownToStep', () => {
  it('rounds down to the step and drops seconds', () => {
    expect(roundDownToStep(at(18, 10, 40))).toEqual(at(18, 0));
    expect(roundDownToStep(at(18, 0))).toEqual(at(18, 0));
  });
});

describe('getEarliestStart', () => {
  it('is the first step at least 15 minutes away', () => {
    expect(getEarliestStart(at(17, 52))).toEqual(at(18, 15));
    expect(getEarliestStart(at(17, 30))).toEqual(at(17, 45));
  });

  it('ignores the seconds (5:30:20 → 5:45)', () => {
    expect(getEarliestStart(at(17, 30, 20))).toEqual(at(17, 45));
  });

  it('skips a step less than 15 whole minutes away (5:31 → 6:00)', () => {
    expect(getEarliestStart(at(17, 31))).toEqual(at(18, 0));
  });
});

describe('getLatestStart', () => {
  it('is 14 days from now', () => {
    expect(getLatestStart(at(17, 30))).toEqual(new Date(2026, 11, 4, 17, 30));
  });
});

describe('toAllowedStart', () => {
  const now = at(17, 30);

  it('rounds a pick up onto a step', () => {
    expect(toAllowedStart(at(19, 5), now)).toEqual(at(19, 15));
  });

  it('moves a pick that is too early to the earliest start', () => {
    expect(toAllowedStart(at(17, 35), now)).toEqual(at(17, 45));
    expect(toAllowedStart(at(9, 0), now)).toEqual(at(17, 45));
  });

  it('moves a pick past 14 days to the last step before the limit', () => {
    expect(toAllowedStart(new Date(2026, 11, 10, 12, 0), now)).toEqual(
      new Date(2026, 11, 4, 17, 30),
    );
  });
});

describe('checkStartTime', () => {
  const now = at(17, 30);

  it('accepts a time in the future within 14 days', () => {
    expect(checkStartTime(at(18, 0), now)).toBeNull();
    expect(checkStartTime(new Date(2026, 11, 4, 17, 30), now)).toBeNull();
  });

  it('refuses a time that has passed, or is right now', () => {
    expect(checkStartTime(at(17, 15), now)).toBe('in_past');
    expect(checkStartTime(at(17, 30), now)).toBe('in_past');
  });

  it('refuses a time more than 14 days ahead', () => {
    expect(checkStartTime(new Date(2026, 11, 4, 17, 45), now)).toBe('too_far_ahead');
  });
});
