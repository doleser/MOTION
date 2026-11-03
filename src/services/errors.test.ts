import type {AuthError, PostgrestError} from '@supabase/supabase-js';

import {
  fromAuthError,
  fromCompleteProfileError,
  getErrorMessage,
  isServiceError,
  ServiceError,
} from './errors';

const authError = (code?: string) => ({code, message: 'raw'}) as unknown as AuthError;
const dbError = (code: string, message = 'raw') =>
  ({code, message}) as unknown as PostgrestError;

describe('getErrorMessage', () => {
  it('returns the service message for a ServiceError', () => {
    const error = new ServiceError('underage', 'You must be 18 or older to use Motion.');
    expect(getErrorMessage(error)).toBe('You must be 18 or older to use Motion.');
  });

  it('returns a generic message for anything else', () => {
    expect(getErrorMessage(new Error('database down'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(getErrorMessage('nope')).toBe('Something went wrong. Please try again.');
  });
});

describe('fromAuthError', () => {
  it.each([
    ['user_already_exists', 'email_taken'],
    ['email_exists', 'email_taken'],
    ['weak_password', 'weak_password'],
    ['email_address_invalid', 'invalid_email'],
    ['validation_failed', 'invalid_email'],
    ['invalid_credentials', 'invalid_credentials'],
  ])('maps %s to %s', (code, expected) => {
    const result = fromAuthError(authError(code));
    expect(isServiceError(result, expected as never)).toBe(true);
  });

  it('leaves unknown errors (like rate limits) generic', () => {
    const result = fromAuthError(authError('over_email_send_rate_limit'));
    expect(isServiceError(result)).toBe(false);
    expect(getErrorMessage(result)).toBe('Something went wrong. Please try again.');
  });
});

describe('fromCompleteProfileError', () => {
  it('maps a duplicate username, naming the username', () => {
    const result = fromCompleteProfileError(dbError('23505'), 'hooper');
    expect(result).toMatchObject({
      code: 'username_taken',
      message: 'Someone just took "hooper". Pick another username.',
    });
  });

  it('maps a missing username, but an unknown level is generic', () => {
    expect(
      isServiceError(
        fromCompleteProfileError(dbError('22023', 'Username is required.'), 'x'),
        'invalid_username',
      ),
    ).toBe(true);
    expect(
      isServiceError(fromCompleteProfileError(dbError('22023', 'Unknown level: pro'), 'x')),
    ).toBe(false);
  });

  it('maps the username_format check, but other checks are generic', () => {
    expect(
      isServiceError(
        fromCompleteProfileError(
          dbError('23514', 'violates check constraint "username_format"'),
          'x',
        ),
        'invalid_username',
      ),
    ).toBe(true);
    expect(
      isServiceError(
        fromCompleteProfileError(
          dbError('23514', 'violates check constraint "profiles_height_cm_check"'),
          'x',
        ),
      ),
    ).toBe(false);
  });

  it('returns null when the profile was already complete', () => {
    expect(fromCompleteProfileError(dbError('55000'), 'x')).toBeNull();
  });

  it('leaves any other error generic', () => {
    const result = fromCompleteProfileError(dbError('08006'), 'x');
    expect(result).not.toBeNull();
    expect(isServiceError(result)).toBe(false);
  });
});