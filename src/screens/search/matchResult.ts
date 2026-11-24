/**
 * Rules for the 1v1 result screens. Pure functions (no server calls), so
 * they're easy to test.
 */
import type {ChallengeResult} from '../../services/challenges';

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

/**
 * The main button on the match check-in screen:
 *   - 'check_in': CHECK IN AT MEETING COURT
 *   - 'waiting_for_opponent': greyed WAITING FOR <NAME>
 *   - 'waiting_for_start': both here, but report_result rejects reports
 *     before the start, so a greyed STARTS AT <TIME>
 *   - 'start_match': START MATCH (ranked), which opens the result screen
 *   - 'casual_ready': both here for a casual match; no button, since casual
 *     results aren't recorded
 *   - 'report_result': the match is over and no one reported yet; REPORT
 *     RESULT until REPORT_WINDOW_HOURS after the end (no check-in needed)
 *   - 'view_result': someone already reported; opens the result screen
 *   - 'none': nothing left to do
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

export interface MatchActionInput {
  ranked: boolean;
  hasResult: boolean;
  startsAt: Date;
  durationMinutes: number;
  youCheckedIn: boolean;
  opponentReady: boolean;
}

/** Which main button the match check-in screen shows right now. */
export function getMatchAction(match: MatchActionInput, now: Date): MatchAction {
  const start = match.startsAt.getTime();
  const end = start + match.durationMinutes * 60 * 1000;
  if (match.ranked && match.hasResult) return 'view_result';
  if (now.getTime() >= end) {
    const reportOpen = now.getTime() <= end + REPORT_WINDOW_HOURS * HOUR_MS;
    return match.ranked && reportOpen ? 'report_result' : 'none';
  }
  if (!match.youCheckedIn) return 'check_in';
  if (!match.opponentReady) return 'waiting_for_opponent';
  if (!match.ranked) return 'casual_ready';
  if (now.getTime() < start) return 'waiting_for_start';
  return 'start_match';
}

/** "+16", "-14", or "0": a rating change, from before and after. */
export function formatEloDelta(change: {eloBefore: number; eloAfter: number}): string {
  const delta = change.eloAfter - change.eloBefore;
  return delta > 0 ? `+${delta}` : `${delta}`;
}
