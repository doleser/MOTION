import {searchPlayers} from './players';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({supabase: {rpc: jest.fn()}}));

const rpc = supabase.rpc as jest.Mock;

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
