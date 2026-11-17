import {getPlayerProfile, searchPlayers} from './players';
import {getPlayerRecord} from './records';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({
  supabase: {rpc: jest.fn(), from: jest.fn(), auth: {getSession: jest.fn()}},
}));
jest.mock('./records', () => ({getPlayerRecord: jest.fn()}));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;
const getSession = supabase.auth.getSession as jest.Mock;
const getRecord = getPlayerRecord as jest.Mock;

const row = {
  user_id: '22222222-2222-2222-2222-222222222222',
  real_name: 'Johanna Lee',
  username: 'johanna',
  elo: 1462,
};

const player = {
  userId: '22222222-2222-2222-2222-222222222222',
  realName: 'Johanna Lee',
  username: 'johanna',
  elo: 1462,
};

describe('searchPlayers', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('searches a one-letter prefix and maps the rows', async () => {
    rpc.mockResolvedValue({data: [row], error: null});

    await expect(searchPlayers('j')).resolves.toEqual([player]);
    expect(rpc).toHaveBeenCalledWith('search_players', {p_query: 'j'});
  });

  it('sends a trimmed, lowercase query', async () => {
    rpc.mockResolvedValue({data: [row], error: null});

    await expect(searchPlayers('  JoH  ')).resolves.toEqual([player]);
    expect(rpc).toHaveBeenCalledWith('search_players', {p_query: 'joh'});
  });

  it('returns no rows without calling the server for an empty or invalid query', async () => {
    await expect(searchPlayers('')).resolves.toEqual([]);
    await expect(searchPlayers('@noahk')).resolves.toEqual([]);
    await expect(searchPlayers('noah k')).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps "Not signed in." to not_signed_in', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {code: '42501', message: 'Not signed in.'},
    });

    await expect(searchPlayers('j')).rejects.toMatchObject({
      code: 'not_signed_in',
      message: 'Not signed in.',
    });
  });

  it('leaves any other database error as is', async () => {
    const failure = {code: '08006', message: 'connection failure'};
    rpc.mockResolvedValue({data: null, error: failure});

    await expect(searchPlayers('j')).rejects.toBe(failure);
  });
});

describe('getPlayerProfile', () => {
  const userId = '22222222-2222-2222-2222-222222222222';
  const record = {wins: 3, losses: 1, streak: {result: 'W', count: 2}, recentResults: ['L', 'W', 'W']};

  /** The query chain, answering `answer` at the end. */
  function mockProfileQuery(answer: {data: unknown; error: unknown}) {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue(answer),
    };
    from.mockReturnValue(query);
    return query;
  }

  beforeEach(() => {
    from.mockReset();
    getRecord.mockReset().mockResolvedValue(record);
    getSession.mockReset().mockResolvedValue({data: {session: {user: {id: 'me'}}}});
  });

  it('reads a finished profile and its record', async () => {
    const query = mockProfileQuery({
      data: {user_id: userId, real_name: 'Johanna Lee', username: 'johanna', elo: 1462, open_to_challenges: false},
      error: null,
    });

    await expect(getPlayerProfile(userId)).resolves.toEqual({
      userId,
      realName: 'Johanna Lee',
      username: 'johanna',
      elo: 1462,
      openToChallenges: false,
      record,
    });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(query.eq).toHaveBeenCalledWith('user_id', userId);
    // Unfinished sign-ups are left out, like in search.
    expect(query.not).toHaveBeenCalledWith('onboarded_at', 'is', null);
    expect(getRecord).toHaveBeenCalledWith(userId);
  });

  it('says player_not_found when there is no such profile', async () => {
    mockProfileQuery({data: null, error: null});

    await expect(getPlayerProfile(userId)).rejects.toMatchObject({code: 'player_not_found'});
  });

  it('says player_not_found for a profile without a username or real name', async () => {
    mockProfileQuery({
      data: {user_id: userId, real_name: null, username: 'johanna', elo: 800, open_to_challenges: true},
      error: null,
    });

    await expect(getPlayerProfile(userId)).rejects.toMatchObject({code: 'player_not_found'});
  });

  it('says not_signed_in without asking the server when signed out', async () => {
    getSession.mockResolvedValue({data: {session: null}});

    await expect(getPlayerProfile(userId)).rejects.toMatchObject({code: 'not_signed_in'});
    expect(from).not.toHaveBeenCalled();
  });

  it('leaves a database error as is', async () => {
    const failure = {code: '08006', message: 'connection failure'};
    mockProfileQuery({data: null, error: failure});

    await expect(getPlayerProfile(userId)).rejects.toBe(failure);
  });
});
