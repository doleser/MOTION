/**
 * Profile service (STUB).
 *
 * A fake, in-memory stand-in for the `profiles` table. The real version will
 * call Supabase; screens won't change.
 *
 * New profiles are NOT created here; see `createAccount` in account.ts.
 */
import {peekSession} from './auth';
import {ServiceError} from './errors';
import {fakeDelay} from './fakeDelay';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'skipped';

export interface Profile {
  userId: string;
  /** The database allows null, but createAccount always sets it. */
  username: string | null;
  elo: number;
  openToChallenges: boolean;
  position?: string;
  heightCm?: number;
  tags?: string[];
  /** The court the player usually plays at (id from the courts service). */
  homeCourtId?: number;
}

/** The profile answers collected during sign-up. */
export interface CreateProfileInput {
  username: string;
  level: SkillLevel;
  position?: string;
  heightCm?: number;
  tags?: string[];
  homeCourtId?: number;
}

/** Same as the `elo` column default in the database. */
const DEFAULT_ELO = 1200;

/**
 * Starting Elo for each self-assessed level. The ONE place this mapping
 * lives: the StartingElo preview and the createAccount stub both read it.
 *
 * Skipping starts in the middle (800), so skipping is never better than
 * answering honestly.
 *
 * TODO(team): not final. The design doc also mentions "clamp to 900-1500",
 * which contradicts these. The real number will come from the backend
 * (complete_profile still says skipped = 1200 and needs the same change).
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

// ---------- Fake in-memory state ----------

/** Pretend these belong to other players. */
const TAKEN_USERNAMES = ['hooper', 'admin'];

/**
 * Pretend someone grabs these while you're onboarding: they pass the check
 * on ChooseHandle but fail at createAccount. Use "sniped" to test it.
 */
const TAKEN_AT_SAVE_USERNAMES = ['sniped'];

const profilesByUserId = new Map<string, Profile>();

/** True if any player has this username, ignoring case. */
function isUsernameTaken(username: string): boolean {
  const lower = username.toLowerCase();
  if (TAKEN_USERNAMES.includes(lower)) {
    return true;
  }
  for (const profile of profilesByUserId.values()) {
    if (profile.username?.toLowerCase() === lower) {
      return true;
    }
  }
  return false;
}

// ---------- Public API ----------

/** The signed-in user's profile. */
export async function getMyProfile(): Promise<Profile> {
  await fakeDelay();
  const session = peekSession();
  if (!session) {
    throw new ServiceError('not_signed_in', 'You need to be signed in.');
  }
  const userId = session.user.id;

  // Every account gets its profile at creation, so this fallback (matching
  // the database default row) shouldn't be needed.
  return (
    profilesByUserId.get(userId) ?? {
      userId,
      username: null,
      elo: DEFAULT_ELO,
      openToChallenges: true,
    }
  );
}

/**
 * True if nobody has this username yet. Works while signed out.
 * Throws 'invalid_username' if it breaks the format rule.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  await fakeDelay();
  const formatError = getUsernameError(username);
  if (formatError) {
    throw new ServiceError('invalid_username', formatError);
  }
  return !isUsernameTaken(username);
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
export async function getAvailableUsernames(usernames: string[]): Promise<string[]> {
  await fakeDelay();
  return usernames.filter(
    (username) => getUsernameError(username) === null && !isUsernameTaken(username),
  );
}

// ---------- Stub-only helpers (used by account.ts) ----------

/** Throws if a new profile can't use this username. */
export function stubCheckNewUsername(username: string): void {
  const formatError = getUsernameError(username);
  if (formatError) {
    throw new ServiceError('invalid_username', formatError);
  }
  if (
    isUsernameTaken(username) ||
    TAKEN_AT_SAVE_USERNAMES.includes(username.toLowerCase())
  ) {
    throw new ServiceError(
      'username_taken',
      `Someone just took "${username}". Pick another username.`,
    );
  }
}

/** Saves a new profile with its starting Elo. Call stubCheckNewUsername first. */
export function stubInsertProfile(
  userId: string,
  input: CreateProfileInput,
): Profile {
  const {level, ...details} = input;
  const profile: Profile = {
    userId,
    elo: STARTING_ELO_BY_LEVEL[level],
    openToChallenges: true,
    ...details,
  };
  profilesByUserId.set(userId, profile);
  return profile;
}
