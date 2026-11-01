import {getUsernameError, STARTING_ELO_BY_LEVEL} from './profile';

describe('getUsernameError', () => {
  it('accepts 3 to 16 letters, numbers, or underscores', () => {
    expect(getUsernameError('abc')).toBeNull();
    expect(getUsernameError('a'.repeat(16))).toBeNull();
    expect(getUsernameError('player_1')).toBeNull();
  });

  it('rejects handles outside that pattern', () => {
    expect(getUsernameError('ab')).toBe(
      'Use 3-16 letters, numbers, or underscores.',
    );
    expect(getUsernameError('a'.repeat(17))).toBe(
      'Use 3-16 letters, numbers, or underscores.',
    );
    expect(getUsernameError('bad-name')).toBe(
      'Use 3-16 letters, numbers, or underscores.',
    );
  });
});

describe('STARTING_ELO_BY_LEVEL', () => {
  it('gives every level a starting Elo, with skipped matching advanced', () => {
    expect(STARTING_ELO_BY_LEVEL).toEqual({
      beginner: 400,
      intermediate: 800,
      advanced: 1200,
      skipped: 1200,
    });
  });
});
