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
  | 'username_taken';

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
