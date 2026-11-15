/**
 * Players service: finding other players and reading their profiles.
 *
 * Still STUBS with fake data until the backend has what they need; screens
 * won't change when they switch over:
 *   - searchPlayers → a search_players(p_query) database function (Owen)
 *   - getPlayerProfile → a player_profile(p_user_id) database function, plus
 *     the real getPlayerRecord (records.ts) for the record
 *   - getPendingChallengeCount → the challenges backend (not built yet)
 */
import {ServiceError} from './errors';
import type {GameResult, PlayerRecord} from './records';
import {parseSearchQuery, usernameMatches} from './searchQuery';
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

interface FakePlayer extends PlayerSearchResult {
  /** False = started sign-up but never finished (no onboarded_at). */
  finishedSignUp: boolean;
  openToChallenges: boolean;
  record: PlayerRecord;
}

/** A fake record. `form` is the recent results, oldest first. */
function fakeRecord(wins: number, losses: number, form: GameResult[]): PlayerRecord {
  // The streak is the run of identical results at the newest end.
  const newest = form[form.length - 1];
  let count = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === newest; i--) {
    count++;
  }
  return {wins, losses, streak: newest ? {result: newest, count} : null, recentResults: form};
}

// What each fake player tests on their profile (see also challenges.ts):
//   mayac: not accepting challenges · devs: challenge pending
//   samr: declined you recently · johanna, jo_bell, hoopdreams: Send fails
//   hoopdreams: no games yet (dashes and empty form squares)
const FAKE_PLAYERS: FakePlayer[] = [
  {userId: 'fake-1', realName: 'Noah Kim', username: 'noahk', elo: 1506, finishedSignUp: true, openToChallenges: true, record: fakeRecord(18, 12, ['W', 'L', 'L', 'W', 'W'])},
  {userId: 'fake-2', realName: 'Maya Chen', username: 'mayac', elo: 1350, finishedSignUp: true, openToChallenges: false, record: fakeRecord(9, 7, ['L', 'W', 'W', 'L', 'W'])},
  {userId: 'fake-3', realName: 'Dev Shah', username: 'devs', elo: 1398, finishedSignUp: true, openToChallenges: true, record: fakeRecord(14, 10, ['W', 'W', 'L', 'L', 'L'])},
  {userId: 'fake-4', realName: 'Sam Rivera', username: 'samr', elo: 1284, finishedSignUp: true, openToChallenges: true, record: fakeRecord(6, 9, ['L', 'L', 'W', 'L', 'W'])},
  {userId: 'fake-5', realName: 'Johnny Nguyen', username: 'johnny_n', elo: 1420, finishedSignUp: true, openToChallenges: true, record: fakeRecord(21, 15, ['W', 'W', 'W', 'L', 'W'])},
  {userId: 'fake-6', realName: 'John Park', username: 'JohnP', elo: 1210, finishedSignUp: true, openToChallenges: true, record: fakeRecord(3, 8, ['L', 'W', 'L', 'L', 'L'])},
  {userId: 'fake-7', realName: 'Johanna Lee', username: 'johanna', elo: 1462, finishedSignUp: true, openToChallenges: true, record: fakeRecord(25, 11, ['W', 'W', 'W', 'W', 'L'])},
  {userId: 'fake-8', realName: 'Jordan Bell', username: 'jo_bell', elo: 1175, finishedSignUp: true, openToChallenges: true, record: fakeRecord(2, 3, ['W', 'L', 'L'])},
  {userId: 'fake-9', realName: 'Andre Hollis', username: 'hoopdreams', elo: 1330, finishedSignUp: true, openToChallenges: true, record: fakeRecord(0, 0, [])},
  {userId: 'fake-10', realName: 'Marcus Webb', username: 'mwebb_23', elo: 1555, finishedSignUp: true, openToChallenges: true, record: fakeRecord(31, 9, ['W', 'W', 'W', 'W', 'W'])},
  // Never finished sign-up, so search must leave them out ("jo" won't find them).
  {userId: 'fake-11', realName: 'Joey Unfinished', username: 'joey_u', elo: 1200, finishedSignUp: false, openToChallenges: true, record: fakeRecord(0, 0, [])},
];

/**
 * TEMPORARY: a fake player who finished sign-up, for challenges.ts's stubs.
 * Delete with the fake data.
 */
export function getFakePlayer(userId: string): FakePlayer | undefined {
  return FAKE_PLAYERS.find((player) => player.userId === userId && player.finishedSignUp);
}

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
 * How many challenges the signed-in user has received and not yet
 * accepted or declined. Shown as the badge on the Search inbox icon.
 *
 * STUB: always 2. The real one will come from the challenges backend.
 */
export async function getPendingChallengeCount(): Promise<number> {
  await wait(FAKE_DELAY_MS);
  return 2;
}

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
