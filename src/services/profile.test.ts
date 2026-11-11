import {
  getAvailableUsernames,
  getMyProfile,
  getUsernameError,
  STARTING_ELO_BY_LEVEL,
} from './profile';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({
  supabase: {rpc: jest.fn(), from: jest.fn(), auth: {getSession: jest.fn()}},
}));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;
const getSession = supabase.auth.getSession as jest.Mock;
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

describe('getMyProfile', () => {
  const row = {
    user_id: 'u1', username: 'johnny_n', real_name: 'Johnny Nguyễn', elo: 800,
    open_to_challenges: true, position: null, height_cm: null, tags: null,
    home_court_id: null, onboarded_at: '2026-11-11T00:00:00Z', appeal_count: 0,
  };

  function mockRow(data: Record<string, unknown>) {
    getSession.mockResolvedValue({data: {session: {user: {id: 'u1'}}}});
    const single = jest.fn().mockResolvedValue({data, error: null});
    const select = jest.fn(() => ({eq: () => ({single})}));
    from.mockReturnValue({select});
    return select;
  }

  it('asks for real_name and maps it to realName', async () => {
    const select = mockRow(row);
    const profile = await getMyProfile();
    expect(select.mock.calls[0]).toEqual([expect.stringContaining('real_name')]);
    expect(profile).toMatchObject({username: 'johnny_n', realName: 'Johnny Nguyễn'});
  });

  it('leaves realName undefined when the account has no name', async () => {
    mockRow({...row, real_name: null});
    expect((await getMyProfile()).realName).toBeUndefined();
  });
});
