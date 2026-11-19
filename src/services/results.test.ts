import {confirmResult, disputeResult, previewElo} from './results';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({supabase: {rpc: jest.fn()}}));

const rpc = supabase.rpc as jest.Mock;

const stakesRow = {win: 23, lose: -9};

const changeRow = {game_id: 301, elo_before: 950, elo_after: 959};

const gameRow = {
  game_id: 305,
  court_id: 1,
  ranked: true,
  status: 'voided',
  winning_side: 1,
  reported_by: 'alice',
  created_at: '2026-11-09T20:00:00Z',
  confirmed_at: null,
};

describe('previewElo', () => {
  it('calls preview_elo and returns the stakes', async () => {
    rpc.mockResolvedValue({data: stakesRow, error: null});

    await expect(previewElo('bob')).resolves.toEqual({win: 23, lose: -9});
    expect(rpc).toHaveBeenCalledWith('preview_elo', {p_opponent_id: 'bob'});
  });

  it('reads a one-row array, which is how a table comes back', async () => {
    rpc.mockResolvedValue({data: [stakesRow], error: null});

    await expect(previewElo('bob')).resolves.toEqual({win: 23, lose: -9});
  });

  it.each([
    ['42501', 'Not signed in.', 'not_signed_in'],
    ['22023', "You can't play yourself.", 'self_opponent'],
    ['22023', 'Opponent not found.', 'opponent_not_found'],
  ])('maps %s "%s" to %s', async (code, message, expected) => {
    rpc.mockResolvedValue({data: null, error: {code, message}});

    await expect(previewElo('bob')).rejects.toMatchObject({
      code: expected,
      message,
    });
  });

  it('leaves a missing-argument error as is', async () => {
    const failure = {code: '22023', message: 'Opponent is required.'};
    rpc.mockResolvedValue({data: null, error: failure});

    await expect(previewElo('bob')).rejects.toBe(failure);
  });

  it('leaves a revoked call as is', async () => {
    const failure = {code: '42501', message: 'permission denied for function preview_elo'};
    rpc.mockResolvedValue({data: null, error: failure});

    await expect(previewElo('bob')).rejects.toBe(failure);
  });
});

describe('confirmResult', () => {
  it('calls confirm_result and returns the caller change', async () => {
    rpc.mockResolvedValue({data: changeRow, error: null});

    await expect(confirmResult(301)).resolves.toEqual({
      gameId: 301,
      eloBefore: 950,
      eloAfter: 959,
    });
    expect(rpc).toHaveBeenCalledWith('confirm_result', {p_game_id: 301});
  });

  it.each([
    ['22023', 'Game not found.', 'game_not_found'],
    ['22023', 'The other player confirms this result.', 'not_confirmer'],
    ['22023', 'Result is not waiting for confirmation.', 'result_not_pending'],
  ])('maps %s "%s" to %s', async (code, message, expected) => {
    rpc.mockResolvedValue({data: null, error: {code, message}});

    await expect(confirmResult(301)).rejects.toMatchObject({
      code: expected,
      message,
    });
  });

  it('leaves "Game is required." as is', async () => {
    const failure = {code: '22023', message: 'Game is required.'};
    rpc.mockResolvedValue({data: null, error: failure});

    await expect(confirmResult(301)).rejects.toBe(failure);
  });
});

describe('disputeResult', () => {
  it('calls dispute_result and returns the voided game', async () => {
    rpc.mockResolvedValue({data: gameRow, error: null});

    await expect(disputeResult(305)).resolves.toEqual({
      id: 305,
      courtId: 1,
      ranked: true,
      status: 'voided',
      winningSide: 1,
      reportedBy: 'alice',
      createdAt: '2026-11-09T20:00:00Z',
      confirmedAt: null,
    });
    expect(rpc).toHaveBeenCalledWith('dispute_result', {p_game_id: 305});
  });

  it('maps "The other player confirms this result." to not_confirmer', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {code: '22023', message: 'The other player confirms this result.'},
    });

    await expect(disputeResult(305)).rejects.toMatchObject({
      code: 'not_confirmer',
      message: 'The other player confirms this result.',
    });
  });
});
