import {isServiceError, fromAuthError, fromCompleteProfileError, ServiceError} from './errors';
import {getMyProfile, getUsernameError, type Profile, type SkillLevel} from './profile';
import {supabase} from './supabase';

export interface CreateAccountInput {
  email: string;
  password: string;
  /** The user ticked "I'm 18 or older". Rejected here if false. */
  confirmedAdult: boolean;
  username: string;
  level: SkillLevel;
  position?: string;
  heightCm?: number;
  tags?: string[];
  homeCourtId?: number;
}

/**
 * Signs up, saves the profile, leaves the user signed in. Throws a ServiceError:
 * - SignUp screen: 'email_taken', 'underage', 'invalid_email', 'weak_password'
 * - ChooseHandle screen: 'username_taken', 'invalid_username'
 * If anything fails after the account exists, the user is signed out, so the app
 * never holds a session for an account with no profile. Retrying with the same
 * email and password finishes the sign-up (see signUpOrResume).
 */
export async function createAccount(input: CreateAccountInput): Promise<Profile> {
  const {email, password, confirmedAdult, username} = input;

  if (!confirmedAdult) {
    throw new ServiceError('underage', 'You must be 18 or older to use Motion.');
  }
  const usernameError = getUsernameError(username);
  if (usernameError) {
    throw new ServiceError('invalid_username', usernameError);
  }

  await signUpOrResume(email, password);

  try {
    const {error} = await supabase.rpc('complete_profile', {
      p_username: username,
      p_level: input.level,
      p_position: input.position ?? null,
      p_height_cm: input.heightCm ?? null,
      p_tags: input.tags ?? null,
      p_home_court_id: input.homeCourtId ?? null,
    });
    if (error) {
      const mapped = fromCompleteProfileError(error, username);
      if (mapped) throw mapped;
      // Already complete: either an earlier attempt of THIS sign-up worked, or
      // this email belongs to someone else's finished account.
      const existing = await getMyProfile();
      if (existing.username?.toLowerCase() !== username.toLowerCase()) {
        throw new ServiceError('email_taken', 'That email is already registered. Try logging in instead.');
      }
      return existing;
    }
    return await getMyProfile();
  } catch (e) {
    await supabase.auth.signOut();
    throw e;
  }
}

/**
 * Creates the account. If the email already exists, tries the same password: a
 * match means an earlier attempt created the account but didn't finish, so we
 * carry on. A mismatch means it's someone else's account: 'email_taken'.
 */
async function signUpOrResume(email: string, password: string): Promise<void> {
  const {data, error} = await supabase.auth.signUp({email, password});
  if (!error) {
    if (!data.session) {
      throw new Error('Sign-up did not return a session (is email confirmation on?).');
    }
    return;
  }
  const mapped = fromAuthError(error);
  if (!isServiceError(mapped, 'email_taken')) throw mapped;
  const {error: signInError} = await supabase.auth.signInWithPassword({email, password});
  if (signInError) throw mapped;
}