/**
 * Players service: finding other players and reading their profiles.
 *
 * searchPlayers calls search_players. Profile reads are still a stub in
 * fakePlayers.ts until that backend exists; screens won't change when it
 * switches over:
 *   - searchPlayers → search_players(p_query)
 *   - getPlayerProfile → a player_profile(p_user_id) database function, plus
 *     the real getPlayerRecord (records.ts) for the record
 *   - getPendingChallengeCount → the challenges backend (not built yet)
 */
import {fromPlayerSearchError, ServiceError} from './errors';
import {getFakePlayer} from './fakePlayers';
import type {PlayerRecord} from './records';
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

// ---------- Fake data (TEMPORARY) ----------

/** How long the fake server takes to answer. */
const FAKE_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * The Search inbox badge's count. It lives in challenges.ts now; exported
 * here too so the Search screen's import keeps working.
 */
export {getPendingChallengeCount} from './challenges';

/**
 * Another player's profile and record. Throws 'player_not_found' for an
 * unknown player or one who hasn't finished sign-up.
 *
 * STUB: reads FAKE_PLAYERS. The real one will call a
 * player_profile(p_user_id) database function, which must refuse (as
 * 'player_not_found') when either player has blocked the other, so a
 * blocked player's profile can't be opened from an old link or list.
 */
export async function getPlayerProfile(userId: string): Promise<PlayerProfile> {
  const {data: {session}} = await supabase.auth.getSession();
  if (!session) {
    throw new ServiceError('not_signed_in', 'You need to be signed in.');
  }

  await wait(FAKE_DELAY_MS);
  const player = getFakePlayer(userId);
  if (!player) {
    throw new ServiceError('player_not_found', "We couldn't find that player.");
  }
  const {realName, username, elo, openToChallenges, record} = player;
  return {userId, realName, username, elo, openToChallenges, record};
}
