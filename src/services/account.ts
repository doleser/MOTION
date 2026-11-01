/**
 * Account service (STUB).
 *
 * Creates the account, saves its whole profile, and signs the user in, all
 * in one call at the very end of sign-up. Either everything is saved or
 * nothing is, so an account never exists without a finished profile.
 *
 * The real version will call a backend function.
 */
import {stubCheckNewUser, stubInsertUser, stubSignIn} from './auth';
import {ServiceError} from './errors';
import {fakeDelay} from './fakeDelay';
import {
  type Profile,
  type SkillLevel,
  stubCheckNewUsername,
  stubInsertProfile,
} from './profile';

/** Everything collected during sign-up. */
export interface CreateAccountInput {
  email: string;
  password: string;
  /** The user ticked "I'm 18 or older". The server rejects false. */
  confirmedAdult: boolean;
  username: string;
  level: SkillLevel;
  position?: string;
  heightCm?: number;
  tags?: string[];
  preferredCourtIds?: number[];
}

/**
 * Returns the new profile with its provisional starting Elo. On success the
 * user is signed in.
 *
 * Throws a ServiceError; check its `code` to send the user to the screen
 * that can fix it:
 * - SignUp: 'email_taken' (email already registered), 'underage',
 *   'invalid_email', 'weak_password'
 * - ChooseHandle: 'username_taken', 'invalid_username'
 */
export async function createAccount(input: CreateAccountInput): Promise<Profile> {
  await fakeDelay();
  const {email, password, confirmedAdult, ...profile} = input;

  if (!confirmedAdult) {
    throw new ServiceError('underage', 'You must be 18 or older to use Motion.');
  }

  // Check everything before saving anything, so a failure leaves nothing
  // behind. (The real backend does this inside one database transaction.)
  stubCheckNewUser(email, password);
  stubCheckNewUsername(profile.username);

  const user = stubInsertUser(email, password);
  const saved = stubInsertProfile(user.id, profile);
  stubSignIn(user);
  return saved;
}
