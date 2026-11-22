import {
  acceptChallenge,
  cancelChallenge,
  createChallenge,
  declineChallenge,
  getChallenge,
  getChallengeStatus,
  getPendingChallengeCount,
  listMyChallenges,
} from './challenges';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({supabase: {rpc: jest.fn()}}));

const rpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  rpc.mockReset();
});

/** A challenge_row as Postgres sends it, result columns included. */
const pendingRow = {
  challenge_id: 7,
  direction: 'incoming',
  status: 'pending',
  opponent_id: 'player-2',
  opponent_real_name: 'Noah Kim',
  opponent_username: 'noahk',
  opponent_elo: 1506,
  ranked: true,
  court_id: 3,
  court_name: 'Green Lake',
  starts_at: '2026-11-21T02:00:00+00:00',
  duration_minutes: 60,
  closed_at: null,
  game_id: null,
  game_status: null,
  winner_id: null,
  reported_by: null,
};

const pendingChallenge = {
  id: 7,
  direction: 'incoming',
  status: 'pending',
  opponent: {userId: 'player-2', realName: 'Noah Kim', username: 'noahk', elo: 1506},
  ranked: true,
  court: {id: 3, name: 'Green Lake'},
  startsAt: new Date('2026-11-21T02:00:00Z'),
  durationMinutes: 60,
  closedAt: null,
};

describe('getChallengeStatus', () => {
  it('calls challenge_status and returns its answer', async () => {
    rpc.mockResolvedValue({data: 'declined_recently', error: null});

    await expect(getChallengeStatus('player-2')).resolves.toBe('declined_recently');
    expect(rpc).toHaveBeenCalledWith('challenge_status', {p_opponent_id: 'player-2'});
  });

  it('maps "Player not found." to player_not_found', async () => {
    rpc.mockResolvedValue({data: null, error: {code: '22023', message: 'Player not found.'}});

    await expect(getChallengeStatus('player-2')).rejects.toMatchObject({
      code: 'player_not_found',
      message: "We couldn't find that player.",
    });
  });
});

describe('createChallenge', () => {
  const newChallenge = {
    opponentId: 'player-2',
    ranked: false,
    courtId: 3,
    startsAt: new Date('2026-11-21T02:00:00Z'),
    durationMinutes: 45,
  };

  it('sends the start time as ISO and returns the new id', async () => {
    rpc.mockResolvedValue({data: 12, error: null});

    await expect(createChallenge(newChallenge)).resolves.toBe(12);
    expect(rpc).toHaveBeenCalledWith('create_challenge', {
      p_opponent_id: 'player-2',
      p_ranked: false,
      p_court_id: 3,
      p_starts_at: '2026-11-21T02:00:00.000Z',
      p_duration_minutes: 45,
    });
  });

  it.each([
    ['42501', 'Not signed in.', 'not_signed_in'],
    ['22023', 'Player not found.', 'player_not_found'],
    ['22023', 'Court not found.', 'court_not_found'],
    ['22023', 'Pick a match length of 15, 30, 45, or 60 minutes.', 'invalid_match_length'],
    ['22023', 'That time has passed.', 'challenge_time_passed'],
    ['22023', 'Pick a time within the next 14 days.', 'challenge_too_far_ahead'],
    ['22023', 'Not accepting challenges.', 'not_accepting_challenges'],
    ['22023', 'Challenge already pending.', 'challenge_pending'],
    ['22023', 'Declined in the last 24 hours.', 'challenge_cooldown'],
    ['22023', 'You already have a match at that time.', 'challenger_busy'],
  ])('maps %s "%s" to %s', async (code, message, expected) => {
    rpc.mockResolvedValue({data: null, error: {code, message}});

    await expect(createChallenge(newChallenge)).rejects.toMatchObject({code: expected});
  });

  it('shows the app message, not the database one', async () => {
    rpc.mockResolvedValue({data: null, error: {code: '22023', message: 'Not accepting challenges.'}});

    await expect(createChallenge(newChallenge)).rejects.toMatchObject({
      message: "This player isn't accepting challenges right now.",
    });
  });

  it('leaves an unmapped message as is (a client bug)', async () => {
    const failure = {code: '22023', message: "You can't challenge yourself."};
    rpc.mockResolvedValue({data: null, error: failure});

    await expect(createChallenge(newChallenge)).rejects.toBe(failure);
  });

  it('leaves other error codes as is', async () => {
    const failure = {code: '22P02', message: 'Player not found.'};
    rpc.mockResolvedValue({data: null, error: failure});

    await expect(createChallenge(newChallenge)).rejects.toBe(failure);
  });
});

describe('listMyChallenges', () => {
  it('maps every row', async () => {
    const declinedRow = {
      ...pendingRow,
      challenge_id: 8,
      direction: 'outgoing',
      status: 'declined',
      closed_at: '2026-11-19T20:00:00+00:00',
    };
    rpc.mockResolvedValue({data: [pendingRow, declinedRow], error: null});

    await expect(listMyChallenges()).resolves.toEqual([
      pendingChallenge,
      {
        ...pendingChallenge,
        id: 8,
        direction: 'outgoing',
        status: 'declined',
        closedAt: new Date('2026-11-19T20:00:00Z'),
      },
    ]);
    expect(rpc).toHaveBeenCalledWith('list_my_challenges');
  });

  it('returns an empty list when there are none', async () => {
    rpc.mockResolvedValue({data: [], error: null});
    await expect(listMyChallenges()).resolves.toEqual([]);

    rpc.mockResolvedValue({data: null, error: null});
    await expect(listMyChallenges()).resolves.toEqual([]);
  });

  it('fills in a missing name', async () => {
    rpc.mockResolvedValue({
      data: [{...pendingRow, opponent_real_name: null, opponent_username: null}],
      error: null,
    });

    const [challenge] = await listMyChallenges();
    expect(challenge.opponent).toMatchObject({realName: 'Unknown player', username: 'unknown'});
  });

  it('maps "Not signed in." to not_signed_in', async () => {
    rpc.mockResolvedValue({data: null, error: {code: '42501', message: 'Not signed in.'}});

    await expect(listMyChallenges()).rejects.toMatchObject({code: 'not_signed_in'});
  });
});

describe('getChallenge', () => {
  it('calls get_challenge and maps the row', async () => {
    rpc.mockResolvedValue({data: [pendingRow], error: null});

    await expect(getChallenge(7)).resolves.toEqual(pendingChallenge);
    expect(rpc).toHaveBeenCalledWith('get_challenge', {p_challenge_id: 7});
  });

  it('maps "Challenge not found." to challenge_not_found', async () => {
    rpc.mockResolvedValue({data: null, error: {code: '22023', message: 'Challenge not found.'}});

    await expect(getChallenge(7)).rejects.toMatchObject({code: 'challenge_not_found'});
  });

  it('treats no row as challenge_not_found', async () => {
    rpc.mockResolvedValue({data: [], error: null});

    await expect(getChallenge(7)).rejects.toMatchObject({code: 'challenge_not_found'});
  });
});

describe.each([
  ['acceptChallenge', acceptChallenge, 'accept_challenge'],
  ['declineChallenge', declineChallenge, 'decline_challenge'],
  ['cancelChallenge', cancelChallenge, 'cancel_challenge'],
])('%s', (_name, action, fn) => {
  it(`calls ${fn} and returns the challenge afterwards`, async () => {
    rpc.mockResolvedValue({data: [{...pendingRow, status: 'confirmed'}], error: null});

    await expect(action(7)).resolves.toEqual({...pendingChallenge, status: 'confirmed'});
    expect(rpc).toHaveBeenCalledWith(fn, {p_challenge_id: 7});
  });

  it.each([
    ['Challenge not found.', 'challenge_not_found'],
    ['Challenge expired.', 'challenge_expired'],
    ['Challenge already answered.', 'challenge_already_answered'],
    ['Match ended.', 'match_ended'],
    ['You already have a match at that time.', 'challenger_busy'],
  ])('maps "%s" to %s', async (message, expected) => {
    rpc.mockResolvedValue({data: null, error: {code: '22023', message}});

    await expect(action(7)).rejects.toMatchObject({code: expected});
  });

  it('throws when no row comes back', async () => {
    rpc.mockResolvedValue({data: [], error: null});

    await expect(action(7)).rejects.toThrow(`${fn} returned no row.`);
  });
});

describe('getPendingChallengeCount', () => {
  it('calls pending_challenge_count and returns the number', async () => {
    rpc.mockResolvedValue({data: 3, error: null});

    await expect(getPendingChallengeCount()).resolves.toBe(3);
    expect(rpc).toHaveBeenCalledWith('pending_challenge_count');
  });
});
