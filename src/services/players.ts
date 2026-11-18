/**
 * Players service: finding other players and reading their profiles.
 *
 *   - searchPlayers → search_players(p_query)
 *   - getPlayerProfile → reads the profiles table, plus player_record
 *     (getPlayerRecord in records.ts) for the record. TEMPORARY until a
 *     player_profile(p_user_id) database function exists: that one must
 *     also refuse when either player has blocked the other, which the
 *     profiles table can't check from the app.
 */
import {fromPlayerSearchError, ServiceError} from './errors';
import {getPlayerRecord, type PlayerRecord} from './records';
import {parseSearchQuery} from './searchQuery';
import {supabase} from './supabase';

/** One player in the search results. */
export interface PlayerSearchResult {
  userId: string;
  /** Required at sign-up, so every player has one. */
  realName: string;
  username: string;
  elo: number;
}

/** Another player's profile, as shown on their Player Profile screen. */
export interface PlayerProfile {
  userId: string;
  realName: string;
  username: string;
  elo: number;
  /** False when they've turned off "open to challenges". */
  openToChallenges: boolean;
  record: PlayerRecord;
}

/** The most results one search returns. */
export const MAX_SEARCH_RESULTS = 20;

// ---------- Public API ----------

interface PlayerSearchRow {
  user_id: string;
  real_name: string;
  username: string;
  elo: number;
}

/**
 * Players whose username starts with `query` (ignoring capitalization), up
 * to MAX_SEARCH_RESULTS, sorted by username. A query that can't match (see
 * parseSearchQuery) returns [] without asking the server.
 *
 * The database leaves out the signed-in user, players who haven't finished
 * sign-up, and players blocked in either direction.
 */
export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const parsed = parseSearchQuery(query);
  if (parsed.kind !== 'ok') {
    return [];
  }

  const {data, error} = await supabase.rpc('search_players', {p_query: parsed.query});
  if (error) {
    throw fromPlayerSearchError(error);
  }
  return ((data ?? []) as PlayerSearchRow[]).map((row) => ({
    userId: row.user_id,
    realName: row.real_name,
    username: row.username,
    elo: row.elo,
  }));
}

/**
 * Another player's profile and record. Throws 'player_not_found' for an
 * unknown player or one who hasn't finished sign-up (the same players
 * search leaves out).
 *
 * TEMPORARY: reads the profiles table directly, which doesn't check blocks.
 * Switch to player_profile(p_user_id) once it exists; it must refuse (as
 * 'player_not_found') when either player has blocked the other, so a
 * blocked player's profile can't be opened from an old link or list.
 */
export async function getPlayerProfile(userId: string): Promise<PlayerProfile> {
  const {data: {session}} = await supabase.auth.getSession();
  if (!session) {
    throw new ServiceError('not_signed_in', 'You need to be signed in.');
  }

  // Both at once: the record doesn't depend on the profile.
  const [{data, error}, record] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, real_name, username, elo, open_to_challenges')
      .eq('user_id', userId)
      .not('onboarded_at', 'is', null)
      .maybeSingle(),
    getPlayerRecord(userId),
  ]);
  if (error) throw error;
  // No row, or a profile search wouldn't show either.
  if (!data || !data.username || !data.real_name) {
    throw new ServiceError('player_not_found', "We couldn't find that player.");
  }

  return {
    userId: data.user_id,
    realName: data.real_name,
    username: data.username,
    elo: data.elo,
    openToChallenges: data.open_to_challenges,
    record,
  };
}
