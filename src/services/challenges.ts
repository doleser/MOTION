/**
 * Challenges service: sending, answering, and listing 1v1 challenges.
 *
 * Every function calls one Postgres function from
 * supabase/migrations/20261119210000_challenges.sql:
 *   - getChallengeStatus → challenge_status(p_opponent_id)
 *   - createChallenge → create_challenge(p_opponent_id, p_ranked, p_court_id,
 *     p_starts_at, p_duration_minutes)
 *   - listMyChallenges → list_my_challenges()
 *   - getChallenge → get_challenge(p_challenge_id)
 *   - acceptChallenge / declineChallenge / cancelChallenge →
 *     accept_challenge / decline_challenge / cancel_challenge(p_challenge_id)
 *   - getPendingChallengeCount → pending_challenge_count()
 *
 * The rules (who can be challenged, overlaps, cooldowns, expiry) are enforced in
 * Postgres; this file doesn't re-check them. Two statuses are never stored and
 * come from the clock: 'expired' and 'ended' (getDisplayStatus in
 * challengeStatus.ts). The inbox sections are in challengeStatus.ts and the time
 * rules the pickers use are in challengeTime.ts.
 *
 * Errors: Postgres raises 42501 'Not signed in.' or 22023 with a fixed message
 * (listed at the top of the migration). fromChallengeError turns those into a
 * ServiceError with the user-facing text in MESSAGES. Any other message is a bug
 * on our side and shows the generic message. fromChallengeError lives here, not
 * in errors.ts, only to avoid a conflict with #106; it can move there later.
 *
 * To see challenges locally, use two accounts and
 * supabase/snippets/challenge_test_data.sql (see services/README.md).
 */
import type {PostgrestError} from '@supabase/supabase-js';

import type {ChallengeDirection, StoredChallengeStatus} from './challengeStatus';
import {MAX_DAYS_AHEAD} from './challengeTime';
import type {Court} from './courts';
import {ServiceError, type ServiceErrorCode} from './errors';
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

// ---------- Messages ----------

/** What the user sees for each error, shared by every function here. */
const MESSAGES = {
  not_signed_in: 'You need to be signed in.',
  not_accepting_challenges: "This player isn't accepting challenges right now.",
  challenge_pending: "There's already a pending challenge between you two.",
  challenge_cooldown: 'They declined your last challenge. You can challenge them again later.',
  challenger_busy: 'You already have a match at that time.',
  challenge_time_passed: 'That time has passed. Pick a new time.',
  challenge_too_far_ahead: `Pick a time within the next ${MAX_DAYS_AHEAD} days.`,
  invalid_match_length: 'Pick a match length of 15, 30, 45, or 60 minutes.',
  player_not_found: "We couldn't find that player.",
  court_not_found: "We couldn't find that court.",
  challenge_not_found: "We couldn't find that challenge.",
  challenge_expired: 'This challenge has expired.',
  challenge_already_answered: 'This challenge has already been answered.',
  match_ended: 'This match has already ended.',
} satisfies Partial<Record<ServiceErrorCode, string>>;

type ChallengeErrorCode = keyof typeof MESSAGES;

/**
 * The 22023 messages the challenge functions raise, and the code each one means.
 * Copied from the header comment of the challenges migration; keep them in sync.
 * report_result's messages aren't here because nothing in this file calls it.
 */
const DB_MESSAGES: Record<string, ChallengeErrorCode> = {
  'Player not found.': 'player_not_found',
  'Court not found.': 'court_not_found',
  'Pick a match length of 15, 30, 45, or 60 minutes.': 'invalid_match_length',
  'That time has passed.': 'challenge_time_passed',
  'Pick a time within the next 14 days.': 'challenge_too_far_ahead',
  'Not accepting challenges.': 'not_accepting_challenges',
  'Challenge already pending.': 'challenge_pending',
  'Declined in the last 24 hours.': 'challenge_cooldown',
  'You already have a match at that time.': 'challenger_busy',
  'Challenge not found.': 'challenge_not_found',
  'Challenge expired.': 'challenge_expired',
  'Challenge already answered.': 'challenge_already_answered',
  'Match ended.': 'match_ended',
};

function serviceError(code: ChallengeErrorCode): ServiceError {
  return new ServiceError(code, MESSAGES[code]);
}

/**
 * Turns a challenge function's error into a ServiceError the screens can tell
 * apart. Anything unmapped (missing arguments, "You can't challenge yourself.",
 * network errors) is returned as is, so getErrorMessage shows the generic message.
 */
function fromChallengeError(error: PostgrestError): Error {
  if (error.code === '42501') {
    return serviceError('not_signed_in');
  }
  const code = error.code === '22023' ? DB_MESSAGES[error.message] : undefined;
  return code ? serviceError(code) : error;
}

// ---------- Rows ----------

/**
 * One challenge_row from Postgres. The result columns (game_id, game_status,
 * winner_id, reported_by) also come back but aren't used yet; add them to
 * Challenge when the Post Result / Confirm screens need them.
 */
interface ChallengeRow {
  challenge_id: number;
  direction: ChallengeDirection;
  status: StoredChallengeStatus;
  opponent_id: string;
  opponent_real_name: string | null;
  opponent_username: string | null;
  opponent_elo: number;
  ranked: boolean;
  court_id: number;
  court_name: string;
  starts_at: string;
  duration_minutes: number;
  closed_at: string | null;
}

function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.challenge_id,
    direction: row.direction,
    status: row.status,
    opponent: {
      userId: row.opponent_id,
      realName: row.opponent_real_name ?? 'Unknown player',
      username: row.opponent_username ?? 'unknown',
      elo: row.opponent_elo,
    },
    ranked: row.ranked,
    court: {id: row.court_id, name: row.court_name},
    startsAt: new Date(row.starts_at),
    durationMinutes: row.duration_minutes,
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
  };
}

/** Runs a function that returns one challenge_row (as a set) and maps it. */
async function callForOne(fn: string, challengeId: number): Promise<Challenge> {
  const {data, error} = await supabase.rpc(fn, {p_challenge_id: challengeId});
  if (error) {
    throw fromChallengeError(error);
  }
  const row = ((data ?? []) as ChallengeRow[])[0];
  if (!row) {
    throw new Error(`${fn} returned no row.`);
  }
  return toChallenge(row);
}

// ---------- Public API ----------

/**
 * Whether the signed-in user can challenge `opponentId` right now.
 * Throws 'player_not_found' for an unknown or blocked player.
 */
export async function getChallengeStatus(opponentId: string): Promise<ChallengeStatus> {
  const {data, error} = await supabase.rpc('challenge_status', {p_opponent_id: opponentId});
  if (error) {
    throw fromChallengeError(error);
  }
  return data as ChallengeStatus;
}

/**
 * The Elo stakes of a ranked game against `opponentId`.
 *
 * TODO: TEMPORARY fixed numbers. Jace's #106 adds the real previewElo to
 * results.ts; once it merges, switch the screens' imports (and EloStakes) to
 * results.ts and delete this.
 */
export async function previewElo(opponentId: string): Promise<EloStakes> {
  void opponentId; // the real one sends it; the screens already pass it
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {win: 16, lose: -14};
}

/**
 * Sends a 1v1 challenge and returns its id. Only the signed-in user's confirmed
 * matches are checked for overlap, not the opponent's.
 *
 * Fails with a ServiceError the screens can tell apart:
 *   - 'invalid_match_length': not 15, 30, 45, or 60
 *   - 'challenge_time_passed' / 'challenge_too_far_ahead'
 *   - 'player_not_found' / 'court_not_found'
 *   - 'not_accepting_challenges', 'challenge_pending', 'challenge_cooldown'
 *   - 'challenger_busy': overlaps one of the user's confirmed matches
 */
export async function createChallenge(challenge: NewChallenge): Promise<number> {
  const {data, error} = await supabase.rpc('create_challenge', {
    p_opponent_id: challenge.opponentId,
    p_ranked: challenge.ranked,
    p_court_id: challenge.courtId,
    p_starts_at: challenge.startsAt.toISOString(),
    p_duration_minutes: challenge.durationMinutes,
  });
  if (error) {
    throw fromChallengeError(error);
  }
  return data as number;
}

/**
 * The signed-in user's challenges, both directions and every status, soonest
 * first. Leaves out ones that finished more than 2 days ago; sortIntoSections
 * (challengeStatus.ts) hides finished ones after 24 hours.
 */
export async function listMyChallenges(): Promise<Challenge[]> {
  const {data, error} = await supabase.rpc('list_my_challenges');
  if (error) {
    throw fromChallengeError(error);
  }
  return ((data ?? []) as ChallengeRow[]).map(toChallenge);
}

/**
 * One of the signed-in user's challenges, at any age. Throws
 * 'challenge_not_found' if it doesn't exist or isn't theirs.
 */
export async function getChallenge(challengeId: number): Promise<Challenge> {
  const {data, error} = await supabase.rpc('get_challenge', {p_challenge_id: challengeId});
  if (error) {
    throw fromChallengeError(error);
  }
  const row = ((data ?? []) as ChallengeRow[])[0];
  if (!row) {
    throw serviceError('challenge_not_found');
  }
  return toChallenge(row);
}

/**
 * Accepts an incoming challenge; it becomes a confirmed match. Fails with:
 *   - 'challenge_not_found'
 *   - 'challenge_expired': its match time has come
 *   - 'challenge_already_answered': no longer pending (e.g. they cancelled)
 *   - 'challenger_busy': overlaps one of the user's confirmed matches
 */
export async function acceptChallenge(challengeId: number): Promise<Challenge> {
  return callForOne('accept_challenge', challengeId);
}

/**
 * Declines an incoming challenge, which starts a 24 hour cooldown for the
 * challenger. Fails with 'challenge_not_found', 'challenge_expired', or
 * 'challenge_already_answered'.
 */
export async function declineChallenge(challengeId: number): Promise<Challenge> {
  return callForOne('decline_challenge', challengeId);
}

/**
 * Cancels a pending challenge the user sent, or a confirmed match (either
 * direction) that hasn't ended. Fails with:
 *   - 'challenge_not_found'
 *   - 'challenge_expired' / 'challenge_already_answered': a sent challenge
 *     that's no longer pending
 *   - 'match_ended': a confirmed match that's over or has a posted result
 */
export async function cancelChallenge(challengeId: number): Promise<Challenge> {
  return callForOne('cancel_challenge', challengeId);
}

/**
 * How many challenges are in "Needs your answer": received and still pending.
 * Shown as the badge on the Search inbox icon.
 */
export async function getPendingChallengeCount(): Promise<number> {
  const {data, error} = await supabase.rpc('pending_challenge_count');
  if (error) {
    throw fromChallengeError(error);
  }
  return data as number;
}
