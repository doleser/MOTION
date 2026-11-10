import type {AuthError, PostgrestError} from '@supabase/supabase-js';

/**
 * The one error type every service throws.
 *
 * Screens check `error.code` to decide what to do (e.g. go back to
 * ChooseHandle on 'username_taken') and show `error.message` to the user.
 */
export type ServiceErrorCode =
  | 'underage'
  | 'invalid_email'
  | 'weak_password'
  | 'email_taken'
  | 'invalid_credentials'
  | 'not_signed_in'
  | 'invalid_username'
  | 'username_taken'
  | 'too_far'
  | 'court_unavailable'
  | 'already_checked_in'
  | 'not_checked_in'
  | 'court_not_found'
  | 'self_opponent'
  | 'opponent_not_found'
  | 'game_not_found'
  | 'not_confirmer'
  | 'result_not_pending';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

/**
 * A message that's safe to show the user for any caught error.
 * Unexpected errors (bugs, crashes) get a generic message.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ServiceError) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

/** Lets screens write `if (isServiceError(e, 'username_taken'))`. */
export function isServiceError(
  error: unknown,
  code?: ServiceErrorCode,
): error is ServiceError {
  return (
    error instanceof ServiceError && (code === undefined || error.code === code)
  );
}
/**
 * Turns a Supabase auth error into a ServiceError the screens understand.
 * Anything unmapped (rate limits, outages) is returned as is, so
 * getErrorMessage shows the generic message.
 */
export function fromAuthError(error: AuthError): Error {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return new ServiceError(
        'email_taken',
        'That email is already registered. Try logging in instead.',
      );
    case 'weak_password':
      return new ServiceError('weak_password', 'Choose a stronger password.');
    case 'email_address_invalid':
    case 'validation_failed':
      return new ServiceError('invalid_email', 'Enter a valid email address.');
    case 'invalid_credentials':
      return new ServiceError('invalid_credentials', 'Incorrect email or password.');
    default:
      return error;
  }
}

/**
 * Turns a complete_profile error into a ServiceError. Returns null when the
 * profile was already complete (55000); the caller decides what that means.
 * Errors that point at a bug on our side are returned as is (generic message).
 */
export function fromCompleteProfileError(
  error: PostgrestError,
  username: string,
): Error | null {
  switch (error.code) {
    case '23505':
      return new ServiceError(
        'username_taken',
        `Someone just took "${username}". Pick another username.`,
      );
    case '22023':
      // 'Username is required.' vs 'Unknown level: ...' (a bug).
      return /username/i.test(error.message)
        ? new ServiceError('invalid_username', 'Pick a username to continue.')
        : error;
    case '23514':
      // username_format vs the position / height / tags checks (bugs).
      return error.message.includes('username_format')
        ? new ServiceError('invalid_username', 'Use 3-16 letters, numbers, or underscores.')
        : error;
    case '55000':
      return null;
    default:
      return error;
  }
}

/**
 * Turns a check_in or check_out error into a ServiceError the court screen
 * can show. Anything else (including "Court and location are required.") is
 * returned as is, so getErrorMessage shows the generic message.
 */
export function fromCheckInError(error: PostgrestError): Error {
  if (error.code === '42501') {
    return new ServiceError('not_signed_in', 'Not signed in.');
  }
  if (error.code !== '22023') {
    return error;
  }
  switch (error.message) {
    case 'Too far from the court.':
      return new ServiceError('too_far', error.message);
    case 'Court is not available.':
      return new ServiceError('court_unavailable', error.message);
    case 'Already checked in.':
      return new ServiceError('already_checked_in', error.message);
    case 'Not checked in.':
      return new ServiceError('not_checked_in', error.message);
    default:
      return error;
  }
}

/**
 * Turns a preview_elo, confirm_result, or dispute_result error into a
 * ServiceError. Missing arguments stay as they are, so getErrorMessage shows
 * the generic message. A 42501 that is not "Not signed in." (a revoked call)
 * stays as it is too.
 */
export function fromResultError(error: PostgrestError): Error {
  if (error.code === '42501' && error.message === 'Not signed in.') {
    return new ServiceError('not_signed_in', error.message);
  }
  if (error.code !== '22023') {
    return error;
  }
  switch (error.message) {
    case "You can't play yourself.":
      return new ServiceError('self_opponent', error.message);
    case 'Opponent not found.':
      return new ServiceError('opponent_not_found', error.message);
    case 'Game not found.':
      return new ServiceError('game_not_found', error.message);
    case 'The other player confirms this result.':
      return new ServiceError('not_confirmer', error.message);
    case 'Result is not waiting for confirmation.':
      return new ServiceError('result_not_pending', error.message);
    default:
      return error;
  }
}
