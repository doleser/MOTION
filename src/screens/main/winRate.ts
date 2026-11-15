/**
 * Win rate and streak, as plain functions (no UI) so they can be tested.
 * Used by both the Profile tab and other players' profiles.
 */
import type {PlayerRecord} from '../../services/records';

/** A player's games, as the backend would send them. */
export interface WinLoss {
  wins: number;
  losses: number;
}

/**
 * The share of games won, as a whole percent (26-14 -> 65). Exact halves
 * round up (1-7 is 12.5% -> 13). Null when no games have been played, since
 * there's nothing to divide by.
 */
export function getWinRate({wins, losses}: WinLoss): number | null {
  const games = wins + losses;
  if (games === 0) {
    return null;
  }
  // Multiply before dividing, so halves like 12.5 come out exact.
  return Math.round((wins * 100) / games);
}

/** What the Profile screen shows: "65%", or "—" with no games yet. */
export function formatWinRate(record: WinLoss): string {
  const rate = getWinRate(record);
  return rate === null ? '—' : `${rate}%`;
}

/** What the profile screens show for a streak: "W3", or "—" with no games yet. */
export function formatStreak(streak: PlayerRecord['streak']): string {
  return streak && streak.count > 0 ? `${streak.result}${streak.count}` : '—';
}
