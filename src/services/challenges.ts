/**
 * Challenges service: whether a player can be challenged, the Elo stakes,
 * and sending a 1v1 challenge.
 *
 * Still STUBS with fake data until the challenges backend exists; screens
 * won't change when they switch over:
 *   - getChallengeStatus → a challenge_status(p_opponent_id) database function
 *   - previewElo → Jace's preview_elo(p_opponent_id) (results.ts on
 *     feat/elo-results). Once that branch is merged, use his previewElo
 *     and delete this one.
 *   - createChallenge → a create_challenge(...) database function
 *
 * The fake state lives in memory, so it resets when the app reloads.
 */
import {
  checkStartTime,
  isAllowedMatchLength,
  matchesOverlap,
  MAX_DAYS_AHEAD,
  type MatchWindow,
} from './challengeTime';
import {ServiceError, type ServiceErrorCode} from './errors';
import {getFakePlayer} from './players';
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

/** After a decline, the same player can't be challenged again for this long. */
const DECLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ---------- Fake data (TEMPORARY) ----------

const FAKE_DELAY_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** At `hour`:`minute` tomorrow, phone time. */
function tomorrowAt(hour: number, minute: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * The signed-in user's accepted matches. Sending a challenge that overlaps
 * one fails with "You already have a match at that time."
 * Test: tomorrow 6:00 PM for 45 min, so 6:00-6:45 PM is taken.
 */
const myAcceptedMatches: MatchWindow[] = [{startsAt: tomorrowAt(18, 0), durationMinutes: 45}];

/** Players with a pending challenge between them and the user. Dev starts here. */
const pendingWith = new Set<string>(['fake-3']);

/** When each player last declined the user. Sam declined 2 hours ago. */
const declinedAt = new Map<string, Date>([['fake-4', new Date(Date.now() - 2 * 60 * 60 * 1000)]]);

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

/** Fake stakes by opponent; anyone else gets the default. */
const FAKE_STAKES: Record<string, EloStakes> = {
  'fake-1': {win: 21, lose: -11}, // Noah, rated higher: more to win
  'fake-10': {win: 24, lose: -8}, // Marcus, rated much higher
  'fake-6': {win: 10, lose: -22}, // John, rated lower: more to lose
};
const DEFAULT_FAKE_STAKES: EloStakes = {win: 16, lose: -14};

let nextFakeChallengeId = 100;

// ---------- Messages ----------

/** One message per reason, shared by the status check and sending. */
const MESSAGES = {
  not_accepting_challenges: "This player isn't accepting challenges right now.",
  challenge_pending: "There's already a pending challenge between you two.",
  challenge_cooldown: 'They declined your last challenge. You can challenge them again later.',
  challenger_busy: 'You already have a match at that time.',
  challenge_time_passed: 'That time has passed. Pick a new time.',
  challenge_too_far_ahead: `Pick a time within the next ${MAX_DAYS_AHEAD} days.`,
  invalid_match_length: 'Pick a match length of 15, 30, 45, or 60 minutes.',
  player_not_found: "We couldn't find that player.",
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

/** The status from the fake state (same rules the backend will use). */
function fakeStatus(opponentId: string): ChallengeStatus {
  const player = getFakePlayer(opponentId);
  if (!player) {
    fail('player_not_found');
  }
  if (!player.openToChallenges) {
    return 'not_accepting';
  }
  if (pendingWith.has(opponentId)) {
    return 'pending';
  }
  const declined = declinedAt.get(opponentId);
  if (declined && Date.now() - declined.getTime() < DECLINE_COOLDOWN_MS) {
    return 'declined_recently';
  }
  return 'can_challenge';
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
  await requireSignedIn();
  await wait(FAKE_DELAY_MS);
  return fakeStatus(opponentId);
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
 * checked; only the signed-in user's accepted matches are.
 *
 * Fails with a ServiceError the screens can tell apart:
 *   - 'invalid_match_length': not 15, 30, 45, or 60
 *   - 'challenge_time_passed' / 'challenge_too_far_ahead'
 *   - 'player_not_found'
 *   - 'not_accepting_challenges', 'challenge_pending', 'challenge_cooldown'
 *   - 'challenger_busy': overlaps one of the user's accepted matches
 *
 * STUB: updates the fake state (the opponent becomes "pending"). The real
 * one will call create_challenge(p_opponent_id, p_ranked, p_court_id,
 * p_starts_at, p_duration_minutes), which must check all of the above on
 * the server.
 */
export async function createChallenge(challenge: NewChallenge): Promise<number> {
  await requireSignedIn();
  await wait(FAKE_DELAY_MS);

  if (!isAllowedMatchLength(challenge.durationMinutes)) {
    fail('invalid_match_length');
  }
  const timeProblem = checkStartTime(challenge.startsAt, new Date());
  if (timeProblem === 'in_past') {
    fail('challenge_time_passed');
  }
  if (timeProblem === 'too_far_ahead') {
    fail('challenge_too_far_ahead');
  }

  const status = fakeStatus(challenge.opponentId);
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

  if (myAcceptedMatches.some((match) => matchesOverlap(match, challenge))) {
    fail('challenger_busy');
  }

  pendingWith.add(challenge.opponentId);
  return nextFakeChallengeId++;
}
