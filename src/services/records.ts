/**
 * Records service: a player's wins, losses, streak, and recent results.
 *
 * Everything is worked out in Postgres by player_record, which counts
 * confirmed ranked games only (pending, voided, and casual games don't count).
 * Win rate is worked out on the phone (see winRate.ts).
 */
import {supabase} from './supabase';

export type GameResult = 'W' | 'L';

export interface PlayerRecord {
  wins: number;
  losses: number;
  /** The current run of wins or losses, or null with no games yet. */
  streak: {result: GameResult; count: number} | null;
  /** Results of the most recent games (up to 5), oldest first. */
  recentResults: GameResult[];
}

/** What a player with no games gets. */
const EMPTY_RECORD: PlayerRecord = {wins: 0, losses: 0, streak: null, recentResults: []};

/** Any signed-in user can read any player's record. */
export async function getPlayerRecord(userId: string): Promise<PlayerRecord> {
  const {data, error} = await supabase.rpc('player_record', {p_user_id: userId});
  if (error) throw error;

  // A table function: always one row in practice, but the type is a list.
  const row = data?.[0];
  if (!row) return EMPTY_RECORD;

  return {
    wins: row.wins,
    losses: row.losses,
    // The database sends a signed number: 3 is W3, -2 is L2, 0 is no games.
    streak:
      row.streak === 0
        ? null
        : {result: row.streak > 0 ? 'W' : 'L', count: Math.abs(row.streak)},
    // Already oldest first, which is the screen's left-to-right order.
    recentResults: row.recent.filter(
      (result: string): result is GameResult => result === 'W' || result === 'L',
    ),
  };
}
