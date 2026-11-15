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
