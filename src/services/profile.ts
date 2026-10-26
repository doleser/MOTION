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

// TODO(team): Finalize the level -> starting Elo mapping. The proposal says
// Beginner 400 / Intermediate 800 / Advanced 1200, but also "clamp to
// 900-1500", which contradict each other. Until decided, everyone gets 1200.
export const STARTING_ELO_BY_LEVEL: Readonly<Record<SkillLevel, number>> = {
  beginner: 1200,
  intermediate: 1200,
  advanced: 1200,
  skipped: 1200,
};

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
