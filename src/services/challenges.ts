/**
 * Challenges service: sending, answering, and listing 1v1 challenges.
 *
 * Still STUBS with fake data until the challenges backend exists; screens
 * won't change when they switch over:
 *   - getChallengeStatus → challenge_status(p_opponent_id)
 *   - previewElo → Jace's preview_elo(p_opponent_id) (results.ts on
 *     feat/elo-results). Once that branch is merged, use his previewElo
 *     and delete this one.
 *   - createChallenge → create_challenge(...)
 *   - listMyChallenges → list_my_challenges()
 *   - getChallenge → get_challenge(p_challenge_id)
 *   - acceptChallenge / declineChallenge / cancelChallenge →
 *     accept_challenge / decline_challenge / cancel_challenge(p_challenge_id)
 *   - getMatchReadiness → match_readiness(p_challenge_id)
 *   - getPendingChallengeCount → pending_challenge_count()
 *
 * The status rules (expired, ended, hidden, sections) are in
 * challengeStatus.ts; the time rules are in challengeTime.ts.
 *
 * The fake state lives in memory, so it resets when the app reloads. The
 * seeded challenges are with the fake players in fakePlayers.ts; real players
 * from search can be challenged too (their profile is read for real).
 */
import {
  getDisplayStatus,
  getInboxSection,
  type ChallengeDirection,
  type StoredChallengeStatus,
} from './challengeStatus';
import {checkStartTime, isAllowedMatchLength, matchesOverlap, MAX_DAYS_AHEAD} from './challengeTime';
import {listCourts, type Court} from './courts';
import {ServiceError, type ServiceErrorCode} from './errors';
import {getFakePlayer} from './fakePlayers';
import {getPlayerProfile} from './players';
import {supabase} from './supabase';

/**
 * Whether the signed-in user can challenge a player, and if not, why:
 *   - 'can_challenge'
 *   - 'not_accepting': they turned off "open to challenges"
 *   - 'pending': a challenge between the two is waiting for an answer
 *   - 'declined_recently': they declined the user's challenge in the last 24 hours
 */
export type ChallengeStatus = 'can_challenge' | 'not_accepting' | 'pending' | 'declined_recently';

/** What the signed-in user gains by winning, and loses by losing (negative). */
export interface EloStakes {
  win: number;
  lose: number;
}

export interface NewChallenge {
  opponentId: string;
  ranked: boolean;
  courtId: number;
  startsAt: Date;
  /** 15, 30, 45, or 60 (see MATCH_LENGTHS). */
  durationMinutes: number;
}

/** One of the signed-in user's challenges, from their side. */
export interface Challenge {
  id: number;
  direction: ChallengeDirection;
  /** What the database stores. Use getDisplayStatus (challengeStatus.ts) to show it. */
  status: StoredChallengeStatus;
  opponent: {userId: string; realName: string; username: string; elo: number};
  ranked: boolean;
  court: Court;
  startsAt: Date;
  durationMinutes: number;
  /** When it was declined or cancelled; null otherwise. */
  closedAt: Date | null;
}

/** Whether each player in a confirmed match is checked in at its court. */
export interface MatchReadiness {
  youCheckedIn: boolean;
  opponentCheckedIn: boolean;
}

/** After a decline, the same player can't be challenged again for this long. */
const DECLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ---------- Fake data (TEMPORARY) ----------

const FAKE_DELAY_MS = 500;
const MINUTE_MS = 60 * 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** At `hour`:`minute`, `days` days from today, phone time. */
function dayAt(days: number, hour: number, minute: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** `minutes` from now (negative for the past). */
function fromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * MINUTE_MS);
}

/** A challenge as stored: the opponent and court by id only. */
interface StoredChallenge {
  id: number;
  direction: ChallengeDirection;
  status: StoredChallengeStatus;
  opponentId: string;
  ranked: boolean;
  courtId: number;
  startsAt: Date;
  durationMinutes: number;
  closedAt: Date | null;
}

/** The other player in a challenge, as the stubs need them. */
interface Opponent {
  userId: string;
  realName: string;
  username: string;
  elo: number;
  openToChallenges: boolean;
}

/**
 * Real players the user has challenged, so the inbox can show their names.
 * The fake players are looked up in fakePlayers.ts instead.
 */
const realOpponents = new Map<string, Opponent>();

/** All of the user's challenges. Filled on first use (it needs real courts). */
let fakeChallenges: StoredChallenge[] | null = null;
let nextFakeChallengeId = 100;

/**
 * The fake challenges, one of each kind, at the user's real courts so
 * check-in works. Times are relative to when the app first asks.
 */
function seedFakeChallenges(courts: Court[]): StoredChallenge[] {
  // Spread the fake challenges over the real courts.
  const court = (i: number) => courts[i % courts.length]?.id ?? 0;
  const seed = (
    id: number,
    direction: ChallengeDirection,
    status: StoredChallengeStatus,
    opponentId: string,
    ranked: boolean,
    courtIndex: number,
    startsAt: Date,
    durationMinutes: number,
    closedAt: Date | null = null,
  ): StoredChallenge => ({
    id,
    direction,
    status,
    opponentId,
    ranked,
    courtId: court(courtIndex),
    startsAt,
    durationMinutes,
    closedAt,
  });

  return [
    // NEEDS YOUR ANSWER
    seed(1, 'incoming', 'pending', 'fake-5', false, 0, dayAt(2, 19, 0), 60), // johnny_n: accept works
    seed(2, 'incoming', 'pending', 'fake-10', true, 1, dayAt(1, 18, 30), 30), // mwebb_23: clashes with #4
    seed(3, 'incoming', 'pending', 'fake-2', false, 0, fromNow(10), 15), // mayac: expires in 10 min
    // UPCOMING
    seed(4, 'incoming', 'confirmed', 'fake-6', false, 0, dayAt(1, 18, 0), 45), // JohnP: tomorrow 6:00-6:45 PM
    seed(5, 'outgoing', 'confirmed', 'fake-7', true, 0, fromNow(20), 60), // johanna: check-in open now
    // WAITING
    seed(6, 'outgoing', 'pending', 'fake-3', false, 1, dayAt(1, 20, 0), 45), // devs
    // RECENT (finished less than 24 hours ago)
    seed(7, 'outgoing', 'declined', 'fake-4', true, 1, dayAt(1, 17, 0), 60, fromNow(-120)), // samr declined 2 h ago
    seed(8, 'incoming', 'pending', 'fake-8', false, 0, fromNow(-180), 30), // jo_bell: expired 3 h ago
    seed(9, 'outgoing', 'cancelled', 'fake-9', false, 1, dayAt(1, 12, 0), 30, fromNow(-300)), // hoopdreams: cancelled 5 h ago
    seed(10, 'outgoing', 'confirmed', 'fake-1', true, 0, fromNow(-180), 60), // noahk: ended 2 h ago
    // HIDDEN (finished more than 24 hours ago)
    seed(11, 'incoming', 'declined', 'fake-1', false, 0, fromNow(-20 * 60), 60, fromNow(-30 * 60)),
    seed(12, 'outgoing', 'pending', 'fake-6', false, 1, fromNow(-48 * 60), 45), // expired 2 days ago
  ];
}

/**
 * TEMPORARY: actions that fail as if the other player acted first, so the
 * "status changed meanwhile" message can be tested. Cancelling Dev's
 * challenge fails because Dev answered a moment ago.
 */
const FAKE_ACTION_FAILURES: Record<number, 'challenge_already_answered'> = {6: 'challenge_already_answered'};

/**
 * TEMPORARY: players whose status changes between opening their profile
 * and pressing Send, so the sheet's error messages can be tested. Their
 * profile shows the Challenge button, but sending fails.
 */
const FAKE_SEND_FAILURES: Record<
  string,
  'not_accepting_challenges' | 'challenge_pending' | 'challenge_cooldown'
> = {
  'fake-7': 'not_accepting_challenges', // johanna turned challenges off
  'fake-8': 'challenge_pending', // jo_bell challenged the user first
  'fake-9': 'challenge_cooldown', // hoopdreams declined a moment ago
};

/** TEMPORARY: opponents who have checked in for their match with the user. */
const FAKE_READY_OPPONENTS = new Set(['fake-7']); // johanna

/** Fake stakes by opponent; anyone else gets the default. */
const FAKE_STAKES: Record<string, EloStakes> = {
  'fake-1': {win: 21, lose: -11}, // Noah, rated higher: more to win
  'fake-10': {win: 24, lose: -8}, // Marcus, rated much higher
  'fake-6': {win: 10, lose: -22}, // John, rated lower: more to lose
};
const DEFAULT_FAKE_STAKES: EloStakes = {win: 16, lose: -14};

// ---------- Messages ----------

/** One message per error, shared by every function here. */
const MESSAGES = {
  not_accepting_challenges: "This player isn't accepting challenges right now.",
  challenge_pending: "There's already a pending challenge between you two.",
  challenge_cooldown: 'They declined your last challenge. You can challenge them again later.',
  challenger_busy: 'You already have a match at that time.',
  challenge_time_passed: 'That time has passed. Pick a new time.',
  challenge_too_far_ahead: `Pick a time within the next ${MAX_DAYS_AHEAD} days.`,
  invalid_match_length: 'Pick a match length of 15, 30, 45, or 60 minutes.',
  player_not_found: "We couldn't find that player.",
  challenge_not_found: "We couldn't find that challenge.",
  challenge_expired: 'This challenge has expired.',
  challenge_already_answered: 'This challenge has already been answered.',
  match_ended: 'This match has already ended.',
} satisfies Partial<Record<ServiceErrorCode, string>>;

function fail(code: keyof typeof MESSAGES): never {
  throw new ServiceError(code, MESSAGES[code]);
}

async function requireSignedIn(): Promise<string> {
  const {data: {session}} = await supabase.auth.getSession();
  if (!session) {
    throw new ServiceError('not_signed_in', 'You need to be signed in.');
  }
  return session.user.id;
}

/** The fake challenges and the real courts, after the fake delay. */
async function loadFakeState(): Promise<{stored: StoredChallenge[]; courts: Court[]}> {
  await requireSignedIn();
  const [courts] = await Promise.all([listCourts(), wait(FAKE_DELAY_MS)]);
  fakeChallenges ??= seedFakeChallenges(courts);
  return {stored: fakeChallenges, courts};
}

/** A stored challenge with its opponent and court filled in. */
function toChallenge(stored: StoredChallenge, courts: Court[]): Challenge {
  const player = getFakePlayer(stored.opponentId) ?? realOpponents.get(stored.opponentId);
  return {
    id: stored.id,
    direction: stored.direction,
    status: stored.status,
    opponent: {
      userId: stored.opponentId,
      realName: player?.realName ?? 'Unknown player',
      username: player?.username ?? 'unknown',
      elo: player?.elo ?? 0,
    },
    ranked: stored.ranked,
    court: courts.find((c) => c.id === stored.courtId) ?? {id: stored.courtId, name: 'Unknown court'},
    startsAt: stored.startsAt,
    durationMinutes: stored.durationMinutes,
    closedAt: stored.closedAt,
  };
}

/** True if the user has a confirmed match (not yet ended) overlapping `window`. */
function isUserBusy(
  stored: StoredChallenge[],
  window: {startsAt: Date; durationMinutes: number},
  now: Date,
  ignoreId?: number,
): boolean {
  return stored.some(
    (c) => c.id !== ignoreId && getDisplayStatus(c, now) === 'confirmed' && matchesOverlap(c, window),
  );
}

/**
 * A fake player, or a real one read from the database. Throws
 * 'player_not_found' if neither.
 */
async function getOpponent(opponentId: string): Promise<Opponent> {
  return getFakePlayer(opponentId) ?? getPlayerProfile(opponentId);
}

/** The status from the fake state (same rules the backend will use). */
function fakeOpponentStatus(stored: StoredChallenge[], opponent: Opponent): ChallengeStatus {
  const opponentId = opponent.userId;
  if (!opponent.openToChallenges) {
    return 'not_accepting';
  }
  const now = new Date();
  const withThem = stored.filter((c) => c.opponentId === opponentId);
  if (withThem.some((c) => getDisplayStatus(c, now) === 'pending')) {
    return 'pending';
  }
  const declinedRecently = withThem.some(
    (c) =>
      c.direction === 'outgoing' &&
      c.status === 'declined' &&
      c.closedAt !== null &&
      now.getTime() - c.closedAt.getTime() < DECLINE_COOLDOWN_MS,
  );
  return declinedRecently ? 'declined_recently' : 'can_challenge';
}

/** Finds one of the user's challenges, or fails with 'challenge_not_found'. */
function findStored(stored: StoredChallenge[], challengeId: number): StoredChallenge {
  const found = stored.find((c) => c.id === challengeId);
  if (!found) {
    fail('challenge_not_found');
  }
  return found;
}

/**
 * Fails unless the challenge is still pending: 'challenge_expired' if its
 * time has come, 'challenge_already_answered' otherwise.
 */
function requirePending(challenge: StoredChallenge, now: Date): void {
  const status = getDisplayStatus(challenge, now);
  if (status === 'expired') {
    fail('challenge_expired');
  }
  if (status !== 'pending') {
    fail('challenge_already_answered');
  }
}

// ---------- Public API ----------

/**
 * Whether the signed-in user can challenge `opponentId` right now.
 * Throws 'player_not_found' for an unknown player.
 *
 * STUB: reads the fake state. The real one will call
 * challenge_status(p_opponent_id).
 */
export async function getChallengeStatus(opponentId: string): Promise<ChallengeStatus> {
  const [{stored}, opponent] = await Promise.all([loadFakeState(), getOpponent(opponentId)]);
  return fakeOpponentStatus(stored, opponent);
}

/**
 * The Elo stakes of a ranked game against `opponentId`, from both ratings
 * as they are now. Worked out on the server; the app never computes Elo.
 *
 * STUB: fake numbers. The real one is Jace's previewElo (preview_elo).
 */
export async function previewElo(opponentId: string): Promise<EloStakes> {
  await requireSignedIn();
  await wait(FAKE_DELAY_MS);
  return FAKE_STAKES[opponentId] ?? DEFAULT_FAKE_STAKES;
}

/**
 * Sends a 1v1 challenge and returns its id. The opponent's schedule is NOT
 * checked; only the signed-in user's confirmed matches are.
 *
 * Fails with a ServiceError the screens can tell apart:
 *   - 'invalid_match_length': not 15, 30, 45, or 60
 *   - 'challenge_time_passed' / 'challenge_too_far_ahead'
 *   - 'player_not_found'
 *   - 'not_accepting_challenges', 'challenge_pending', 'challenge_cooldown'
 *   - 'challenger_busy': overlaps one of the user's confirmed matches
 *
 * STUB: adds it to the fake list (it shows in the inbox under WAITING).
 * The real one will call create_challenge(p_opponent_id, p_ranked,
 * p_court_id, p_starts_at, p_duration_minutes), which must check all of
 * the above on the server.
 */
export async function createChallenge(challenge: NewChallenge): Promise<number> {
  const [{stored}, opponent] = await Promise.all([loadFakeState(), getOpponent(challenge.opponentId)]);
  const now = new Date();

  if (!isAllowedMatchLength(challenge.durationMinutes)) {
    fail('invalid_match_length');
  }
  const timeProblem = checkStartTime(challenge.startsAt, now);
  if (timeProblem === 'in_past') {
    fail('challenge_time_passed');
  }
  if (timeProblem === 'too_far_ahead') {
    fail('challenge_too_far_ahead');
  }

  const status = fakeOpponentStatus(stored, opponent);
  if (status === 'not_accepting') {
    fail('not_accepting_challenges');
  }
  if (status === 'pending') {
    fail('challenge_pending');
  }
  if (status === 'declined_recently') {
    fail('challenge_cooldown');
  }

  const fakeFailure = FAKE_SEND_FAILURES[challenge.opponentId];
  if (fakeFailure) {
    fail(fakeFailure);
  }

  if (isUserBusy(stored, challenge, now)) {
    fail('challenger_busy');
  }

  if (!getFakePlayer(opponent.userId)) {
    realOpponents.set(opponent.userId, opponent);
  }
  const id = nextFakeChallengeId++;
  stored.push({
    id,
    direction: 'outgoing',
    status: 'pending',
    opponentId: challenge.opponentId,
    ranked: challenge.ranked,
    courtId: challenge.courtId,
    startsAt: challenge.startsAt,
    durationMinutes: challenge.durationMinutes,
    closedAt: null,
  });
  return id;
}

/**
 * All of the signed-in user's challenges, both directions and every
 * status, including finished ones the inbox no longer shows (sortIntoSections
 * in challengeStatus.ts leaves those out).
 *
 * STUB: the fake list. The real one will call list_my_challenges(), which
 * should only return challenges from roughly the last few days.
 */
export async function listMyChallenges(): Promise<Challenge[]> {
  const {stored, courts} = await loadFakeState();
  return stored.map((c) => toChallenge(c, courts));
}

/**
 * One of the signed-in user's challenges. Throws 'challenge_not_found'
 * if it doesn't exist or isn't theirs.
 *
 * STUB: the fake list. The real one will call get_challenge(p_challenge_id).
 */
export async function getChallenge(challengeId: number): Promise<Challenge> {
  const {stored, courts} = await loadFakeState();
  return toChallenge(findStored(stored, challengeId), courts);
}

/**
 * Accepts an incoming challenge; it becomes a confirmed match. Fails with:
 *   - 'challenge_not_found'
 *   - 'challenge_expired': its match time has come
 *   - 'challenge_already_answered': no longer pending (e.g. they cancelled)
 *   - 'challenger_busy': overlaps one of the user's confirmed matches
 *     ("You already have a match at that time.")
 *
 * STUB: updates the fake list. The real one will call
 * accept_challenge(p_challenge_id).
 */
export async function acceptChallenge(challengeId: number): Promise<Challenge> {
  const {stored, courts} = await loadFakeState();
  const now = new Date();
  const challenge = findStored(stored, challengeId);
  if (challenge.direction !== 'incoming') {
    fail('challenge_not_found');
  }
  requirePending(challenge, now);
  if (isUserBusy(stored, challenge, now, challenge.id)) {
    fail('challenger_busy');
  }
  challenge.status = 'confirmed';
  return toChallenge(challenge, courts);
}

/**
 * Declines an incoming challenge. Fails with 'challenge_not_found',
 * 'challenge_expired', or 'challenge_already_answered'.
 *
 * STUB: updates the fake list. The real one will call
 * decline_challenge(p_challenge_id).
 */
export async function declineChallenge(challengeId: number): Promise<Challenge> {
  const {stored, courts} = await loadFakeState();
  const now = new Date();
  const challenge = findStored(stored, challengeId);
  if (challenge.direction !== 'incoming') {
    fail('challenge_not_found');
  }
  requirePending(challenge, now);
  challenge.status = 'declined';
  challenge.closedAt = now;
  return toChallenge(challenge, courts);
}

/**
 * Cancels a pending challenge the user sent, or a confirmed match (either
 * direction) that hasn't ended. Fails with:
 *   - 'challenge_not_found'
 *   - 'challenge_expired' / 'challenge_already_answered': a sent challenge
 *     that's no longer pending
 *   - 'match_ended': a confirmed match that's over
 *
 * STUB: updates the fake list. The real one will call
 * cancel_challenge(p_challenge_id).
 */
export async function cancelChallenge(challengeId: number): Promise<Challenge> {
  const {stored, courts} = await loadFakeState();
  const now = new Date();
  const challenge = findStored(stored, challengeId);

  const fakeFailure = FAKE_ACTION_FAILURES[challengeId];
  if (fakeFailure) {
    fail(fakeFailure);
  }

  const status = getDisplayStatus(challenge, now);
  if (status === 'ended') {
    fail('match_ended');
  }
  if (status !== 'confirmed') {
    // Only the sender can cancel a pending challenge (the other player declines).
    if (challenge.direction !== 'outgoing') {
      fail('challenge_not_found');
    }
    requirePending(challenge, now);
  }
  challenge.status = 'cancelled';
  challenge.closedAt = now;
  return toChallenge(challenge, courts);
}

/**
 * Whether the signed-in user and their opponent are each checked in at the
 * court of a confirmed match. Throws 'challenge_not_found' if it doesn't
 * exist or isn't theirs.
 *
 * The real backend function, match_readiness(p_challenge_id), returns ONLY
 * these two players' status for this one confirmed match, so it doesn't
 * expose the court's player list.
 *
 * NOT CALLED YET: until match_readiness exists, MatchCheckInScreen uses the
 * real check-in service instead (get_my_check_in for the user,
 * get_court_players for the opponent once the user is at the court).
 * Switch it to this once the real function exists.
 *
 * STUB: the user is never checked in; johanna is, everyone else isn't.
 */
export async function getMatchReadiness(challengeId: number): Promise<MatchReadiness> {
  const {stored} = await loadFakeState();
  const challenge = findStored(stored, challengeId);
  return {
    youCheckedIn: false,
    opponentCheckedIn: FAKE_READY_OPPONENTS.has(challenge.opponentId),
  };
}

/**
 * How many challenges in "Needs your answer": received and still pending.
 * Shown as the badge on the Search inbox icon.
 *
 * STUB: counts the fake list. The real one will call
 * pending_challenge_count().
 */
export async function getPendingChallengeCount(): Promise<number> {
  const {stored} = await loadFakeState();
  const now = new Date();
  return stored.filter((c) => getInboxSection(c, now) === 'needs_answer').length;
}
