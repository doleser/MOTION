/**
 * How match times are written on the inbox, the challenge pop-up, and the
 * check-in screen. (The challenge sheet has its own copy, formatStart; it
 * can switch to this one next time it changes.)
 */

/** "SAT, NOV 22 · 6:15 PM", in the phone's language and time zone. */
export function formatMatchTime(date: Date): string {
  const day = date.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
  return `${day} · ${formatClockTime(date)}`.toUpperCase();
}

/** "6:15 PM", in the phone's language. */
export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
}

/** How long before the start the check-in screen says "Now". */
export const NOW_WINDOW_MINUTES = 5;

const MINUTE_MS = 60 * 1000;

/**
 * Where an accepted match is in time, for the check-in screen:
 *   - 'later': more than NOW_WINDOW_MINUTES before the start
 *   - 'now': from then until the start + length
 *   - 'ended': after the start + length
 *
 * TODO: if the team adds an arrival grace period (e.g. "check in within 10
 * minutes of the start or the match is cancelled"), that's a backend rule;
 * the screen would get a new state for it here.
 */
export function getMatchTiming(
  startsAt: Date,
  durationMinutes: number,
  now: Date,
): 'later' | 'now' | 'ended' {
  const start = startsAt.getTime();
  const end = start + durationMinutes * MINUTE_MS;
  if (now.getTime() >= end) return 'ended';
  if (now.getTime() >= start - NOW_WINDOW_MINUTES * MINUTE_MS) return 'now';
  return 'later';
}
