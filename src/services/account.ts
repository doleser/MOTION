/**
 * Account service (STUB).
 *
 * Creates the account and its profile together, in one call, at the very end
 * of sign-up. Either both are saved or neither is, so an account never exists
 * without a finished profile.
 *
 * It does NOT sign the user in; the app signs in afterwards (StartingElo's
 * Continue button). The real version will call a backend function.
 */
import {stubCheckNewUser, stubInsertUser} from './auth';
import {ServiceError} from './errors';
import {fakeDelay} from './fakeDelay';
import {
  type CreateProfileInput,
  type Profile,
  stubCheckNewUsername,
  stubInsertProfile,
} from './profile';

export interface CreateAccountInput {
  email: string;
  password: string;
  /** The user ticked "I'm 18 or older". The server rejects false. */
  confirmedAdult: boolean;
  profile: CreateProfileInput;
}

/**
 * Returns the new profile with its provisional starting Elo.
 *
 * Throws 'underage', 'invalid_email', 'weak_password', or 'email_taken'
 * (a problem with the SignUp screen's answers), or 'invalid_username' or
 * 'username_taken' (a problem with ChooseHandle's answer).
 */
export async function createAccount(input: CreateAccountInput): Promise<Profile> {
  await fakeDelay();

  if (!input.confirmedAdult) {
    throw new ServiceError('underage', 'You must be 18 or older to use Motion.');
  }

  // Check everything before saving anything, so a failure leaves nothing
  // behind. (The real backend does this inside one database transaction.)
  stubCheckNewUser(input.email, input.password);
  stubCheckNewUsername(input.profile.username);

  const user = stubInsertUser(input.email, input.password);
  return stubInsertProfile(user.id, input.profile);
}
