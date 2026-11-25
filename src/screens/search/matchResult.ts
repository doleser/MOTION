/**
 * Rules for the 1v1 result screens. Pure functions (no server calls), so
 * they're easy to test.
 */
import type {ChallengeResult} from '../../services/challenges';
import {CHECK_IN_OPENS_MINUTES_BEFORE} from '../../services/challengeStatus';

/**
 * Which result view a player sees:
 *   - 'report': no result yet, so pick who won
 *   - 'waiting': I reported; waiting for my opponent to confirm or dispute
 *   - 'confirm': my opponent reported; I confirm or dispute it
 *   - 'result': confirmed, so it counts
 *   - 'disputed': my opponent (or I) disputed it; it doesn't count
 */
export type ResultStage = 'report' | 'waiting' | 'confirm' | 'result' | 'disputed';

/** A pending result is meant to confirm itself this long after it's reported. */
export const AUTO_CONFIRM_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/** The view for the signed-in user (`myUserId`), from the match's result. */
export function getResultStage(result: ChallengeResult | null, myUserId: string): ResultStage {
  if (result === null) return 'report';
  switch (result.status) {
    case 'pending':
      return result.reportedBy === myUserId ? 'waiting' : 'confirm';
    case 'confirmed':
      return 'result';
    case 'voided':
      return 'disputed';
  }
}

/** When a pending result reported at `reportedAt` auto-confirms. */
export function getAutoConfirmAt(reportedAt: Date): Date {
  return new Date(reportedAt.getTime() + AUTO_CONFIRM_HOURS * HOUR_MS);
}

/**
 * "Auto-confirms in 23h". Rounds up, so it never says 0h while time is
 * left; "Auto-confirms in under an hour" in the last hour, and "Auto-confirms
 * soon" once the time has passed (nothing on the server confirms it yet).
 */
export function formatAutoConfirm(reportedAt: Date, now: Date): string {
  const msLeft = getAutoConfirmAt(reportedAt).getTime() - now.getTime();
  if (msLeft <= 0) return 'Auto-confirms soon';
  if (msLeft <= HOUR_MS) return 'Auto-confirms in under an hour';
  return `Auto-confirms in ${Math.ceil(msLeft / HOUR_MS)}h`;
}

/** report_result accepts a result until this long after the match ends. */
export const REPORT_WINDOW_HOURS = 24;

const MINUTE_MS = 60 * 1000;

/** What decides whether a match can start (the same rules start_match checks). */
export interface MatchStartInput {
  startsAt: Date;
  durationMinutes: number;
  /** When a player tapped Start Match, or null. */
  startedAt: Date | null;
  youCheckedIn: boolean;
  opponentReady: boolean;
}

/**
 * When Start Match becomes possible: when check-in opens,
 * CHECK_IN_OPENS_MINUTES_BEFORE the start.
 */
export function getStartOpensAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() - CHECK_IN_OPENS_MINUTES_BEFORE * MINUTE_MS);
}

/**
 * True when Start Match is allowed right now: not started yet, both players
 * checked in, and check-in is open (from CHECK_IN_OPENS_MINUTES_BEFORE the
 * start until the scheduled end, which itself is closed). The server checks
 * the same rules (start_match) plus "no other match in progress".
 */
export function canStartMatch(match: MatchStartInput, now: Date): boolean {
  const end = match.startsAt.getTime() + match.durationMinutes * MINUTE_MS;
  return (
    match.startedAt === null &&
    match.youCheckedIn &&
    match.opponentReady &&
    now.getTime() >= getStartOpensAt(match.startsAt).getTime() &&
    now.getTime() < end
  );
}

/**
 * The main button on the match check-in screen:
 *   - 'check_in': CHECK IN AT MEETING COURT
 *   - 'waiting_for_opponent': greyed WAITING FOR <NAME>
 *   - 'waiting_for_start': both here, but it's before check-in opens, so a
 *     greyed CAN START AT <TIME>
 *   - 'start_match': START MATCH (ranked; canStartMatch)
 *   - 'casual_ready': both here for a casual match; no button, since casual
 *     results aren't recorded
 *   - 'report_result': the match was started and no one reported yet; REPORT
 *     RESULT until REPORT_WINDOW_HOURS after the scheduled end
 *   - 'view_result': someone already reported; opens the result screen
 *   - 'none': nothing left to do (including a match nobody started that has
 *     reached its scheduled end)
 */
export type MatchAction =
  | 'check_in'
  | 'waiting_for_opponent'
  | 'waiting_for_start'
  | 'start_match'
  | 'casual_ready'
  | 'report_result'
  | 'view_result'
  | 'none';

export interface MatchActionInput extends MatchStartInput {
  ranked: boolean;
  hasResult: boolean;
}

/**
 * Which main button the match check-in screen shows right now. Whether the
 * match is under way comes from startedAt, not the clock: an early start
 * shows REPORT RESULT before the scheduled time, and a match nobody started
 * has nothing to report.
 */
export function getMatchAction(match: MatchActionInput, now: Date): MatchAction {
  const end = match.startsAt.getTime() + match.durationMinutes * MINUTE_MS;
  if (match.ranked && match.hasResult) return 'view_result';
  if (match.startedAt !== null) {
    const reportOpen = now.getTime() <= end + REPORT_WINDOW_HOURS * HOUR_MS;
    return match.ranked && reportOpen ? 'report_result' : 'none';
  }
  if (now.getTime() >= end) return 'none';
  if (!match.youCheckedIn) return 'check_in';
  if (!match.opponentReady) return 'waiting_for_opponent';
  if (!match.ranked) return 'casual_ready';
  if (!canStartMatch(match, now)) return 'waiting_for_start';
  return 'start_match';
}

/** "+16", "-14", or "0": a rating change, from before and after. */
export function formatEloDelta(change: {eloBefore: number; eloAfter: number}): string {
  const delta = change.eloAfter - change.eloBefore;
  return delta > 0 ? `+${delta}` : `${delta}`;
}
