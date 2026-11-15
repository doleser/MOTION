/**
 * Players service: finding other players.
 *
 * Still STUBS with fake data until the backend has what they need; screens
 * won't change when they switch over:
 *   - searchPlayers → a search_players(p_query) database function (Owen)
 *   - getPendingChallengeCount → the challenges backend (not built yet)
 */
import {ServiceError} from './errors';
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
}

const FAKE_PLAYERS: FakePlayer[] = [
  {userId: 'fake-1', realName: 'Noah Kim', username: 'noahk', elo: 1506, finishedSignUp: true},
  {userId: 'fake-2', realName: 'Maya Chen', username: 'mayac', elo: 1350, finishedSignUp: true},
  {userId: 'fake-3', realName: 'Dev Shah', username: 'devs', elo: 1398, finishedSignUp: true},
  {userId: 'fake-4', realName: 'Sam Rivera', username: 'samr', elo: 1284, finishedSignUp: true},
  {userId: 'fake-5', realName: 'Johnny Nguyen', username: 'johnny_n', elo: 1420, finishedSignUp: true},
  {userId: 'fake-6', realName: 'John Park', username: 'JohnP', elo: 1210, finishedSignUp: true},
  {userId: 'fake-7', realName: 'Johanna Lee', username: 'johanna', elo: 1462, finishedSignUp: true},
  {userId: 'fake-8', realName: 'Jordan Bell', username: 'jo_bell', elo: 1175, finishedSignUp: true},
  {userId: 'fake-9', realName: 'Andre Hollis', username: 'hoopdreams', elo: 1330, finishedSignUp: true},
  {userId: 'fake-10', realName: 'Marcus Webb', username: 'mwebb_23', elo: 1555, finishedSignUp: true},
  // Never finished sign-up, so search must leave them out ("jo" won't find them).
  {userId: 'fake-11', realName: 'Joey Unfinished', username: 'joey_u', elo: 1200, finishedSignUp: false},
];

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
