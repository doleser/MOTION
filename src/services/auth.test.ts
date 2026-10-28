import {getEmailError, getPasswordError, MIN_PASSWORD_LENGTH} from './auth';

describe('getEmailError', () => {
  it('accepts a normal email', () => {
    expect(getEmailError('player@uw.edu')).toBeNull();
  });

  it('rejects an email with no domain', () => {
    expect(getEmailError('player')).toBe('Enter a valid email address.');
  });
});

describe('getPasswordError', () => {
  it('accepts a password at the minimum length', () => {
    expect(getPasswordError('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('rejects a shorter password', () => {
    expect(getPasswordError('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  });
});
