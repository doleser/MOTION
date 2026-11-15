/**
 * Time rules for 1v1 challenges. Pure functions (no server calls), so the
 * challenge sheet can use them while the player picks, and they're easy to
 * test.
 *
 * The future create_challenge database function must follow the same rules.
 */

/** Allowed match lengths, and the one picked when the sheet opens. */
export const MATCH_LENGTHS = {
  minutes: [15, 30, 45, 60],
  defaultMinutes: 60,
} as const;

export type MatchLengthMinutes = (typeof MATCH_LENGTHS.minutes)[number];

/** Start times are on these steps: 6:00, 6:15, 6:30, 6:45. */
export const START_STEP_MINUTES = 15;

/** The earliest start is at least this far from now (then rounded up to a step). */
export const MIN_LEAD_MINUTES = 15;

/** How far ahead a match can be scheduled. */
export const MAX_DAYS_AHEAD = 14;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A match's time slot: it occupies its start time plus its length. */
export interface MatchWindow {
  startsAt: Date;
  durationMinutes: number;
}

/** True for 15, 30, 45, or 60. */
export function isAllowedMatchLength(minutes: number): minutes is MatchLengthMinutes {
  return (MATCH_LENGTHS.minutes as readonly number[]).includes(minutes);
}

/**
 * Rounds up to the next step, dropping seconds: 5:52 → 6:00, 6:00 → 6:00.
 * Uses the phone's local time.
 */
export function roundUpToStep(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const extra = rounded.getMinutes() % START_STEP_MINUTES;
  // A date with seconds (5:45:30) still needs to move to the next step.
  if (extra !== 0 || rounded.getTime() < date.getTime()) {
    rounded.setMinutes(rounded.getMinutes() - extra + START_STEP_MINUTES);
  }
  return rounded;
}

/** Rounds down to the step, dropping seconds: 6:10 → 6:00, 6:00 → 6:00. */
export function roundDownToStep(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(rounded.getMinutes() - (rounded.getMinutes() % START_STEP_MINUTES));
  return rounded;
}

/**
 * The first time the picker offers: the first step at least
 * MIN_LEAD_MINUTES from now, in whole minutes (at 5:52 → 6:15, and at
 * 5:30:20 → 5:45, since the seconds are ignored).
 */
export function getEarliestStart(now: Date): Date {
  const wholeMinute = new Date(now);
  wholeMinute.setSeconds(0, 0);
  return roundUpToStep(new Date(wholeMinute.getTime() + MIN_LEAD_MINUTES * MINUTE_MS));
}

/** The latest time the picker offers: MAX_DAYS_AHEAD from now. */
export function getLatestStart(now: Date): Date {
  return new Date(now.getTime() + MAX_DAYS_AHEAD * DAY_MS);
}

/**
 * Moves a picked time onto an allowed start: rounded up to a step, and no
 * earlier than getEarliestStart or later than getLatestStart (rounded down
 * to a step). Android's pickers can't enforce steps or limits on their own.
 */
export function toAllowedStart(picked: Date, now: Date): Date {
  const earliest = getEarliestStart(now);
  const latest = roundDownToStep(getLatestStart(now));
  const rounded = roundUpToStep(picked);
  if (rounded.getTime() < earliest.getTime()) {
    return earliest;
  }
  if (rounded.getTime() > latest.getTime()) {
    return latest;
  }
  return rounded;
}

/** What's wrong with a start time, or null if it can be sent. */
export type StartTimeProblem = 'in_past' | 'too_far_ahead';

/**
 * Checks a start time when sending. It must be in the future (it may have
 * passed while the sheet was open) and at most MAX_DAYS_AHEAD away.
 */
export function checkStartTime(startsAt: Date, now: Date): StartTimeProblem | null {
  if (startsAt.getTime() <= now.getTime()) {
    return 'in_past';
  }
  if (startsAt.getTime() > getLatestStart(now).getTime()) {
    return 'too_far_ahead';
  }
  return null;
}

/** When a match ends: its start plus its length. */
export function getEndTime(match: MatchWindow): Date {
  return new Date(match.startsAt.getTime() + match.durationMinutes * MINUTE_MS);
}

/**
 * True if two matches share any time. Back to back doesn't count:
 * 3:00 for 60 min and 4:00 for 60 min don't overlap.
 */
export function matchesOverlap(a: MatchWindow, b: MatchWindow): boolean {
  return (
    a.startsAt.getTime() < getEndTime(b).getTime() &&
    b.startsAt.getTime() < getEndTime(a).getTime()
  );
}
