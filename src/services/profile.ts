/**
 * Profile service: the `profiles` table and username checks, using Supabase.
 *
 * New profiles are NOT created here; see `createAccount` in account.ts.
 */
import {ServiceError} from './errors';
import {supabase} from './supabase';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'skipped';

export interface Profile {
  userId: string;
  /** The database allows null, but createAccount always sets it. */
  username: string | null;
  /** Entered at sign-up. Undefined for accounts made before it was required. */
  realName?: string;
  elo: number;
  openToChallenges: boolean;
  position?: string;
  heightCm?: number;
  tags?: string[];
  /** The court the player usually plays at (id from the courts service). */
  homeCourtId?: number;
  onboardedAt?: Date;
  appealCount: number;
}

/**
 * Starting Elo for each self-assessed level, shown on the StartingElo
 * preview. Must match `complete_profile` in the database, which sets the
 * real starting Elo when the account is created.
 *
 * Skipping starts in the middle (800), so skipping is never better than
 * answering honestly.
 *
 * TODO(team): not final. The design doc also mentions "clamp to 900-1500",
 * which contradicts these.
 */
export const STARTING_ELO_BY_LEVEL: Readonly<Record<SkillLevel, number>> = {
  beginner: 400,
  intermediate: 800,
  advanced: 1200,
  skipped: 800,
};

// ---------- Profile options ----------
// `id` is what gets saved; `label` is what players see, so labels can be
// renamed without touching saved profiles.

export interface ProfileOption {
  id: string;
  label: string;
}

/** Positions, in court order. A player picks at most one. */
export const POSITIONS: readonly ProfileOption[] = [
  {id: 'pg', label: 'PG'},
  {id: 'sg', label: 'SG'},
  {id: 'sf', label: 'SF'},
  {id: 'pf', label: 'PF'},
  {id: 'c', label: 'C'},
];

/** Play-style tags. A player picks up to MAX_PLAY_STYLE_TAGS. */
export const PLAY_STYLE_TAGS: readonly ProfileOption[] = [
  {id: 'shooter', label: 'Shooter'},
  {id: 'slasher', label: 'Slasher'},
  {id: 'playmaker', label: 'Playmaker'},
  {id: 'lockdown_defender', label: 'Lockdown defender'},
  {id: 'rebounder', label: 'Rebounder'},
  {id: 'rim_protector', label: 'Rim protector'},
  {id: 'post_scorer', label: 'Post scorer'},
  {id: 'hustle', label: 'Hustle'},
];

export const MAX_PLAY_STYLE_TAGS = 3;

/** Height range in total inches: 4'6" to 7'6". */
export const HEIGHT_RANGE_INCHES = {min: 54, max: 90} as const;

/** Where the height slider's dot rests before a height is set: 6'0". */
export const STARTING_HEIGHT_INCHES = 72;

// ---------- Username rules ----------

/** Same rule as the `username_format` check in the database. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

/**
 * Returns a message if the username breaks the format rule, or null if it's
 * fine. Runs instantly (no server call), so screens can use it while typing.
 */
export function getUsernameError(username: string): string | null {
  if (USERNAME_PATTERN.test(username)) {
    return null;
  }
  return 'Use 3-16 letters, numbers, or underscores.';
}

// ---------- Public API ----------

/** The signed-in user's profile. */
export async function getMyProfile(): Promise<Profile> {
  const {data: {session}} = await supabase.auth.getSession();
  if (!session) {
    throw new ServiceError('not_signed_in', 'You need to be signed in.');
  }
  const {data, error} = await supabase
    .from('profiles')
    .select(
      'user_id, username, real_name, elo, open_to_challenges, position, height_cm, tags, home_court_id, onboarded_at, appeal_count',
    )
    .eq('user_id', session.user.id)
    .single();
  if (error) throw error;
  return {
    userId: data.user_id,
    username: data.username,
    realName: data.real_name ?? undefined,
    elo: data.elo,
    openToChallenges: data.open_to_challenges,
    position: data.position ?? undefined,
    heightCm: data.height_cm ?? undefined,
    tags: data.tags ?? undefined,
    homeCourtId: data.home_court_id ?? undefined,
    onboardedAt: data.onboarded_at ? new Date(data.onboarded_at) : undefined,
    appealCount: data.appeal_count,
  };
}

/**
 * True if nobody has this username yet. Works while signed out.
 * Throws 'invalid_username' if it breaks the format rule.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const formatError = getUsernameError(username);
  if (formatError) {
    throw new ServiceError('invalid_username', formatError);
  }
  const {data, error} = await supabase.rpc('is_username_available', {name: username});
  if (error) throw error;
  return data;
}

/**
 * Of `usernames`, the ones nobody has yet, in the same order. One call
 * (one request) for the whole list, however long it is. Works while signed
 * out. Names that break the format rule are simply left out.
 *
 * Used to pick a free username suggestion. The real version will call a
 * database function, proposed as `available_usernames(names text[])`
 * (not in the backend yet; see the note for Owen).
 */
// Same contract as before (list of free names, input order). One request per
// candidate until the batch function exists on the backend.
export async function getAvailableUsernames(usernames: string[]): Promise<string[]> {
  const valid = usernames.filter((name) => getUsernameError(name) === null);
  const checks = await Promise.all(
    valid.map(async (name) => ({name, free: await isUsernameAvailable(name)})),
  );
  return checks.filter((c) => c.free).map((c) => c.name);
}

// New: the first free name, or null. Needs the first_available_username migration.
export async function getFirstAvailableUsername(names: string[]): Promise<string | null> {
  const {data, error} = await supabase.rpc('first_available_username', {p_names: names});
  if (error) throw error;
  return data;
}

// New: needs the increment_appeal_count migration.
export async function incrementAppealCount(): Promise<number> {
  const {data, error} = await supabase.rpc('increment_appeal_count');
  if (error) throw error;
  return data;
}
