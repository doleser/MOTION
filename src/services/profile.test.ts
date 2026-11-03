import {getAvailableUsernames, getUsernameError, STARTING_ELO_BY_LEVEL} from './profile';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({
  supabase: {rpc: jest.fn(), from: jest.fn(), auth: {getSession: jest.fn()}},
}));

const rpc = supabase.rpc as jest.Mock;
const TAKEN = ['hooper', 'admin'];

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (_fn: string, args: {name: string}) => ({
    data: !TAKEN.includes(args.name.toLowerCase()),
    error: null,
  }));
});

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
  it('gives every level a starting Elo, with skipped in the middle', () => {
    expect(STARTING_ELO_BY_LEVEL).toEqual({
      beginner: 400,
      intermediate: 800,
      advanced: 1200,
      skipped: 800,
    });
  });
});

describe('getAvailableUsernames', () => {
  it('returns the free names in the same order', async () => {
    await expect(
      getAvailableUsernames(['hooper_1', 'Hooper', 'admin', 'new_name']),
    ).resolves.toEqual(['hooper_1', 'new_name']);
  });

  it('leaves out names that break the format rule without asking the server', async () => {
    await expect(getAvailableUsernames(['ok_name', 'no', 'bad-name'])).resolves.toEqual([
      'ok_name',
    ]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
