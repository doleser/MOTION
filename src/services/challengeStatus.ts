/**
 * Status rules for 1v1 challenges: when one expires or ends, when it
 * leaves the inbox, when check-in is open, and which inbox section it
 * belongs in. Pure functions (no server calls), so they're easy to test.
 *
 * The future challenges backend must follow the same rules.
 */
import {getEndTime} from './challengeTime';

/** Who sent it, from the signed-in user's side. */
export type ChallengeDirection = 'incoming' | 'outgoing';

/** What the database stores. */
export type StoredChallengeStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';

/**
 * What the screens show. Adds two statuses that come from the clock:
 *   - 'expired': still pending when its match time arrived
 *   - 'ended': confirmed, and the match is over
 */
export type ChallengeDisplayStatus = StoredChallengeStatus | 'expired' | 'ended';

/** The parts of a challenge the rules need. */
export interface ChallengeTiming {
  direction: ChallengeDirection;
  status: StoredChallengeStatus;
  startsAt: Date;
  durationMinutes: number;
  /** When it was declined or cancelled; null otherwise. */
  closedAt: Date | null;
  /**
   * The reported result and the other player, if known. Only used to spot a
   * result waiting for the user's answer (isResultAwaitingAnswer).
   */
  result?: {status: 'pending' | 'confirmed' | 'voided'; reportedBy: string} | null;
  opponent?: {userId: string};
}

export type InboxSection = 'needs_answer' | 'upcoming' | 'waiting' | 'recent';

/** Check-in opens this long before the start, and closes when the match ends. */
export const CHECK_IN_OPENS_MINUTES_BEFORE = 30;

/** Finished challenges stay in the inbox this long after they ended. */
export const RECENT_HOURS = 24;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * The status to show right now. A pending challenge expires exactly at its
 * match time; a confirmed match ends exactly at its end time.
 */
export function getDisplayStatus(challenge: ChallengeTiming, now: Date): ChallengeDisplayStatus {
  if (challenge.status === 'pending' && now.getTime() >= challenge.startsAt.getTime()) {
    return 'expired';
  }
  if (challenge.status === 'confirmed' && now.getTime() >= getEndTime(challenge).getTime()) {
    return 'ended';
  }
  return challenge.status;
}

/** True for declined, cancelled, expired, and ended: nothing left to do. */
export function isFinished(status: ChallengeDisplayStatus): boolean {
  return status !== 'pending' && status !== 'confirmed';
}

/**
 * When a finished challenge finished: when it was declined or cancelled,
 * its match time (expired), or its end time (ended). Null if not finished.
 */
export function getFinishedAt(challenge: ChallengeTiming, now: Date): Date | null {
  // A settled result: finished at the match's end. (The time it was
  // confirmed isn't loaded; reports open at the start, so this is close.)
  if (isResultSettled(challenge)) {
    return getEndTime(challenge);
  }
  switch (getDisplayStatus(challenge, now)) {
    case 'declined':
    case 'cancelled':
      // Always set for these; the start time is a safe fallback.
      return challenge.closedAt ?? challenge.startsAt;
    case 'expired':
      return challenge.startsAt;
    case 'ended':
      return getEndTime(challenge);
    default:
      return null;
  }
}

/** True once a finished challenge has been finished for RECENT_HOURS. */
export function isHiddenFromInbox(challenge: ChallengeTiming, now: Date): boolean {
  const finishedAt = getFinishedAt(challenge, now);
  return finishedAt !== null && now.getTime() - finishedAt.getTime() >= RECENT_HOURS * HOUR_MS;
}

/** When check-in opens for a match: CHECK_IN_OPENS_MINUTES_BEFORE its start. */
export function getCheckInOpensAt(challenge: ChallengeTiming): Date {
  return new Date(challenge.startsAt.getTime() - CHECK_IN_OPENS_MINUTES_BEFORE * MINUTE_MS);
}

/**
 * True from 30 minutes before a confirmed match starts until it ends
 * (the end itself is closed).
 */
export function isCheckInOpen(challenge: ChallengeTiming, now: Date): boolean {
  return (
    getDisplayStatus(challenge, now) === 'confirmed' &&
    now.getTime() >= getCheckInOpensAt(challenge).getTime()
  );
}

/** True once the result is confirmed or disputed (voided): nothing left to do. */
export function isResultSettled(challenge: ChallengeTiming): boolean {
  const status = challenge.result?.status;
  return status === 'confirmed' || status === 'voided';
}

/**
 * True when the user reported a result that is still pending, so they're
 * waiting for the other player to confirm or dispute it.
 */
export function isResultAwaitingOpponent(challenge: ChallengeTiming): boolean {
  const {result, opponent} = challenge;
  return result?.status === 'pending' && opponent !== undefined && result.reportedBy !== opponent.userId;
}

/**
 * True when the other player reported a result that is still pending, so
 * the user has to confirm or dispute it.
 */
export function isResultAwaitingAnswer(challenge: ChallengeTiming): boolean {
  const {result, opponent} = challenge;
  return result?.status === 'pending' && opponent !== undefined && result.reportedBy === opponent.userId;
}

/**
 * Which inbox section a challenge goes in, or null once it's hidden. A
 * reported result decides it first:
 *   - waiting for the user's answer: NEEDS YOUR ANSWER
 *   - the user reported, waiting for the other player: WAITING
 *   - confirmed or disputed: RECENT (hidden RECENT_HOURS after the match's
 *     end, like an ended match)
 * The two pending ones aren't hidden while they wait.
 */
export function getInboxSection(challenge: ChallengeTiming, now: Date): InboxSection | null {
  if (isResultAwaitingAnswer(challenge)) {
    return 'needs_answer';
  }
  if (isResultAwaitingOpponent(challenge)) {
    return 'waiting';
  }
  if (isResultSettled(challenge)) {
    return isHiddenFromInbox(challenge, now) ? null : 'recent';
  }
  if (isHiddenFromInbox(challenge, now)) {
    return null;
  }
  const status = getDisplayStatus(challenge, now);
  if (isFinished(status)) {
    return 'recent';
  }
  if (status === 'confirmed') {
    return 'upcoming';
  }
  return challenge.direction === 'incoming' ? 'needs_answer' : 'waiting';
}

/** The inbox's four sections, in display order. */
export interface InboxSections<T> {
  needsAnswer: T[];
  upcoming: T[];
  waiting: T[];
  recent: T[];
}

/**
 * Sorts challenges into the inbox sections and leaves out hidden ones.
 * Live sections are soonest match first; RECENT is most recently finished
 * first.
 */
export function sortIntoSections<T extends ChallengeTiming>(
  challenges: T[],
  now: Date,
): InboxSections<T> {
  const sections: InboxSections<T> = {needsAnswer: [], upcoming: [], waiting: [], recent: []};
  for (const challenge of challenges) {
    switch (getInboxSection(challenge, now)) {
      case 'needs_answer':
        sections.needsAnswer.push(challenge);
        break;
      case 'upcoming':
        sections.upcoming.push(challenge);
        break;
      case 'waiting':
        sections.waiting.push(challenge);
        break;
      case 'recent':
        sections.recent.push(challenge);
        break;
      case null:
        break;
    }
  }
  const soonestFirst = (a: T, b: T) => a.startsAt.getTime() - b.startsAt.getTime();
  sections.needsAnswer.sort(soonestFirst);
  sections.upcoming.sort(soonestFirst);
  sections.waiting.sort(soonestFirst);
  sections.recent.sort(
    (a, b) => (getFinishedAt(b, now)?.getTime() ?? 0) - (getFinishedAt(a, now)?.getTime() ?? 0),
  );
  return sections;
}
