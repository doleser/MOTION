import {getPlayerRecord} from './records';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({supabase: {rpc: jest.fn()}}));

const rpc = supabase.rpc as jest.Mock;

function mockRow(row: {wins: number; losses: number; streak: number; recent: string[]}) {
  rpc.mockResolvedValue({data: [row], error: null});
}

beforeEach(() => {
  rpc.mockReset();
});

describe('getPlayerRecord', () => {
  it('calls player_record for the player and maps a winning streak', async () => {
    mockRow({wins: 7, losses: 3, streak: 3, recent: ['L', 'W', 'W', 'W', 'W']});

    await expect(getPlayerRecord('u1')).resolves.toEqual({
      wins: 7,
      losses: 3,
      streak: {result: 'W', count: 3},
      recentResults: ['L', 'W', 'W', 'W', 'W'],
    });
    expect(rpc).toHaveBeenCalledWith('player_record', {p_user_id: 'u1'});
  });

  it('turns a negative streak into a losing streak', async () => {
    mockRow({wins: 1, losses: 2, streak: -2, recent: ['W', 'L', 'L']});

    await expect(getPlayerRecord('u1')).resolves.toMatchObject({
      streak: {result: 'L', count: 2},
    });
  });

  it('gives a player with no games a 0-0 record and no streak', async () => {
    mockRow({wins: 0, losses: 0, streak: 0, recent: []});

    await expect(getPlayerRecord('u1')).resolves.toEqual({
      wins: 0,
      losses: 0,
      streak: null,
      recentResults: [],
    });
  });

  it('treats no row the same as no games', async () => {
    rpc.mockResolvedValue({data: [], error: null});

    await expect(getPlayerRecord('u1')).resolves.toMatchObject({wins: 0, streak: null});
  });

  it('throws when the database call fails', async () => {
    const error = {code: '42501', message: 'permission denied'};
    rpc.mockResolvedValue({data: null, error});

    await expect(getPlayerRecord('u1')).rejects.toBe(error);
  });
});
