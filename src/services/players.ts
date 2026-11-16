/**
 * Players service: finding other players and reading their profiles.
 *
 * Still STUBS with fake data until the backend has what they need; screens
 * won't change when they switch over:
 *   - searchPlayers → a search_players(p_query) database function (Owen)
 *   - getPlayerProfile → a player_profile(p_user_id) database function, plus
 *     the real getPlayerRecord (records.ts) for the record
 */
import {ServiceError} from './errors';
import {FAKE_PLAYERS, getFakePlayer} from './fakePlayers';
import type {PlayerRecord} from './records';
import {parseSearchQuery, usernameMatches} from './searchQuery';
 * searchPlayers calls search_players. Profile and inbox-count reads are
 * still stubs with fake data until those backends exist; screens won't
 * change when they switch over:
 *   - searchPlayers → search_players(p_query)
 *   - getPlayerProfile → a player_profile(p_user_id) database function, plus
 *     the real getPlayerRecord (records.ts) for the record
 *   - getPendingChallengeCount → the challenges backend (not built yet)
 */
import {fromPlayerSearchError, ServiceError} from './errors';
import type {GameResult, PlayerRecord} from './records';
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

/**
 * TEMPORARY: a query starting with this fails, so the error state can be
 * tested on a phone. Delete with the fake data.
 */
const FAKE_ERROR_PREFIX = 'err';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Public API ----------

/**
 * Players whose username starts with `query` (ignoring capitalization), up
 * to MAX_SEARCH_RESULTS, sorted by username. A query that can't match (see
 * parseSearchQuery) returns [] without asking the server.
 *
 * Never includes the signed-in user or players who haven't finished
 * sign-up.
 *
 * STUB: searches FAKE_PLAYERS. The real one will call a search_players(p_query)
 * database function, which must also hide blocked players in BOTH
 * directions on the server: the app isn't allowed to know who blocked the
 * signed-in user, so it can't filter them out itself.
 */
export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const parsed = parseSearchQuery(query);
  if (parsed.kind !== 'ok') {
    return [];
  }

  const {data: {session}} = await supabase.auth.getSession();
  if (!session) {
    throw new ServiceError('not_signed_in', 'You need to be signed in.');
  }
  const myUserId = session.user.id;

  await wait(FAKE_DELAY_MS);
  if (parsed.query.startsWith(FAKE_ERROR_PREFIX)) {
    throw new Error('Fake search failure');
  }

  return FAKE_PLAYERS.filter(
    (player) =>
      player.finishedSignUp &&
      player.userId !== myUserId &&
      usernameMatches(player.username, parsed.query),
  )
    .sort((a, b) => a.username.localeCompare(b.username))
    .slice(0, MAX_SEARCH_RESULTS)
    .map(({userId, realName, username, elo}) => ({userId, realName, username, elo}));
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
