import {
  checkIn,
  checkOut,
  confirmStillHere,
  getCourtPlayers,
  getMyCheckIn,
} from './checkIns';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({supabase: {rpc: jest.fn()}}));

const rpc = supabase.rpc as jest.Mock;

const openRow = {
  check_in_id: 4,
  user_id: 'player-1',
  court_id: 1,
  checked_in_at: '2026-11-03T20:00:00Z',
  expires_at: '2026-11-03T23:00:00Z',
  checked_out_at: null,
};

const openVisit = {
  id: 4,
  courtId: 1,
  checkedInAt: '2026-11-03T20:00:00Z',
  expiresAt: '2026-11-03T23:00:00Z',
  checkedOutAt: null,
};

describe('checkIn', () => {
  it('calls check_in and returns the visit without the coordinate', async () => {
    rpc.mockResolvedValue({data: openRow, error: null});

    await expect(checkIn(1, 47.66, -122.3)).resolves.toEqual(openVisit);
    expect(rpc).toHaveBeenCalledWith('check_in', {
      p_court_id: 1,
      p_lat: 47.66,
      p_lng: -122.3,
    });
  });

  it.each([
    ['42501', 'Not signed in.', 'not_signed_in'],
    ['22023', 'Too far from the court.', 'too_far'],
    ['22023', 'Court is not available.', 'court_unavailable'],
    ['22023', 'Already checked in.', 'already_checked_in'],
  ])('maps %s "%s" to %s', async (code, message, expected) => {
    rpc.mockResolvedValue({data: null, error: {code, message}});

    await expect(checkIn(1, 47.66, -122.3)).rejects.toMatchObject({
      code: expected,
      message,
    });
  });

  it('leaves any other database error as is', async () => {
    const failure = {code: '22023', message: 'Court and location are required.'};
    rpc.mockResolvedValue({data: null, error: failure});

    await expect(checkIn(1, 47.66, -122.3)).rejects.toBe(failure);
  });
});

describe('checkOut', () => {
  it('calls check_out and returns the closed visit', async () => {
    rpc.mockResolvedValue({
      data: {...openRow, checked_out_at: '2026-11-03T21:00:00Z'},
      error: null,
    });

    await expect(checkOut()).resolves.toEqual({
      ...openVisit,
      checkedOutAt: '2026-11-03T21:00:00Z',
    });
    expect(rpc).toHaveBeenCalledWith('check_out');
  });

  it('maps "Not checked in." to not_checked_in', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {code: '22023', message: 'Not checked in.'},
    });

    await expect(checkOut()).rejects.toMatchObject({
      code: 'not_checked_in',
      message: 'Not checked in.',
    });
  });
});

describe('confirmStillHere', () => {
  it('sends yes and returns the visit', async () => {
    rpc.mockResolvedValue({data: openRow, error: null});

    await expect(confirmStillHere(4, true)).resolves.toEqual(openVisit);
    expect(rpc).toHaveBeenCalledWith('confirm_still_here', {
      p_check_in_id: 4,
      p_answer: true,
    });
  });

  it('sends no and returns the closed visit', async () => {
    rpc.mockResolvedValue({
      data: {...openRow, checked_out_at: '2026-11-03T21:00:00Z'},
      error: null,
    });

    await expect(confirmStillHere(4, false)).resolves.toEqual({
      ...openVisit,
      checkedOutAt: '2026-11-03T21:00:00Z',
    });
    expect(rpc).toHaveBeenCalledWith('confirm_still_here', {
      p_check_in_id: 4,
      p_answer: false,
    });
  });

  it.each([
    ['42501', 'Not signed in.', 'not_signed_in'],
    ['22023', 'Not checked in.', 'not_checked_in'],
  ])('maps %s "%s" to %s', async (code, message, expected) => {
    rpc.mockResolvedValue({data: null, error: {code, message}});

    await expect(confirmStillHere(4, true)).rejects.toMatchObject({
      code: expected,
      message,
    });
  });

  it('throws when no row comes back', async () => {
    rpc.mockResolvedValue({data: null, error: null});

    await expect(confirmStillHere(4, true)).rejects.toThrow(
      'Still-here answer returned no row.',
    );
  });
});

describe('getMyCheckIn', () => {
  it('returns the open visit', async () => {
    rpc.mockResolvedValue({data: [openRow], error: null});

    await expect(getMyCheckIn()).resolves.toEqual(openVisit);
    expect(rpc).toHaveBeenCalledWith('get_my_check_in');
  });

  it('returns null when the player has no open visit', async () => {
    rpc.mockResolvedValue({data: [], error: null});
    await expect(getMyCheckIn()).resolves.toBeNull();

    rpc.mockResolvedValue({data: null, error: null});
    await expect(getMyCheckIn()).resolves.toBeNull();
  });

  it('maps "Not signed in." to not_signed_in', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {code: '42501', message: 'Not signed in.'},
    });

    await expect(getMyCheckIn()).rejects.toMatchObject({code: 'not_signed_in'});
  });
});

describe('getCourtPlayers', () => {
  it('asks for the court and renames the fields', async () => {
    rpc.mockResolvedValue({
      data: [
        {
          user_id: 'player-1',
          username: 'hoopdreams',
          elo: 850,
          checked_in_at: '2026-11-03T20:00:00Z',
        },
      ],
      error: null,
    });

    await expect(getCourtPlayers(1)).resolves.toEqual([
      {
        userId: 'player-1',
        username: 'hoopdreams',
        elo: 850,
        checkedInAt: '2026-11-03T20:00:00Z',
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('get_court_players', {p_court_id: 1});
  });

  it('returns an empty list when the player is not checked in there', async () => {
    rpc.mockResolvedValue({data: [], error: null});
    await expect(getCourtPlayers(1)).resolves.toEqual([]);

    rpc.mockResolvedValue({data: null, error: null});
    await expect(getCourtPlayers(1)).resolves.toEqual([]);
  });

  it('maps "Not signed in." to not_signed_in', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {code: '42501', message: 'Not signed in.'},
    });

    await expect(getCourtPlayers(1)).rejects.toMatchObject({code: 'not_signed_in'});
  });
});