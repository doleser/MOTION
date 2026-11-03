import {listCourts} from './courts';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({supabase: {from: jest.fn()}}));

const from = supabase.from as jest.Mock;

/** Fakes supabase.from('courts').select(...).eq(...).order(...). */
function mockCourtsQuery(result: {data: unknown; error: unknown}) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  };
  from.mockReturnValue(query);
  return query;
}

describe('listCourts', () => {
  it('reads open courts and renames court_id to id', async () => {
    const query = mockCourtsQuery({
      data: [
        {court_id: 1, name: 'Denny Courts'},
        {court_id: 6, name: 'UW IMA'},
      ],
      error: null,
    });

    await expect(listCourts()).resolves.toEqual([
      {id: 1, name: 'Denny Courts'},
      {id: 6, name: 'UW IMA'},
    ]);
    expect(from).toHaveBeenCalledWith('courts');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('throws when the request fails', async () => {
    const failure = {message: 'network down'};
    mockCourtsQuery({data: null, error: failure});
    await expect(listCourts()).rejects.toBe(failure);
  });
});
