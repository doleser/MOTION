/**
 * Results service: the only caller of preview_elo, confirm_result, and
 * dispute_result.
 *
 * The Elo change is decided in Postgres. This module sends the call and
 * does not compute it.
 */
import {fromResultError} from './errors';
import {supabase} from './supabase';

/** What the caller gains by winning, and loses by losing. */
export interface EloStakes {
  win: number;
  lose: number;
}

/** The caller's rating before and after a confirmed game. */
export interface EloChange {
  gameId: number;
  eloBefore: number;
  eloAfter: number;
}

export interface GameResult {
  id: number;
  courtId: number;
  ranked: boolean;
  status: 'pending' | 'confirmed' | 'voided';
  winningSide: 1 | 2;
  reportedBy: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

interface StakesRow {
  win: number;
  lose: number;
}

interface ChangeRow {
  game_id: number;
  elo_before: number;
  elo_after: number;
}

interface GameRow {
  game_id: number;
  court_id: number;
  ranked: boolean;
  status: 'pending' | 'confirmed' | 'voided';
  winning_side: number;
  reported_by: string | null;
  created_at: string;
  confirmed_at: string | null;
}

/**
 * PostgREST returns a table as an array and a composite as one object.
 * Both shapes are one row here.
 */
function oneRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }
  return data;
}

function toStakes(row: StakesRow): EloStakes {
  return {win: row.win, lose: row.lose};
}

function toChange(row: ChangeRow): EloChange {
  return {
    gameId: row.game_id,
    eloBefore: row.elo_before,
    eloAfter: row.elo_after,
  };
}

function toGame(row: GameRow): GameResult {
  return {
    id: row.game_id,
    courtId: row.court_id,
    ranked: row.ranked,
    status: row.status,
    winningSide: row.winning_side as 1 | 2,
    reportedBy: row.reported_by,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}

/** Stakes against opponentId, from the ratings as they are now. */
export async function previewElo(opponentId: string): Promise<EloStakes> {
  const {data, error} = await supabase.rpc('preview_elo', {
    p_opponent_id: opponentId,
  });
  if (error) {
    throw fromResultError(error);
  }
  const row = oneRow(data as StakesRow | StakesRow[] | null);
  if (!row) {
    throw new Error('Preview returned no row.');
  }
  return toStakes(row);
}

/** The other player accepts the reported result. */
export async function confirmResult(gameId: number): Promise<EloChange> {
  const {data, error} = await supabase.rpc('confirm_result', {
    p_game_id: gameId,
  });
  if (error) {
    throw fromResultError(error);
  }
  const row = oneRow(data as ChangeRow | ChangeRow[] | null);
  if (!row) {
    throw new Error('Confirm returned no row.');
  }
  return toChange(row);
}

/** The other player rejects the reported result. Elo does not change. */
export async function disputeResult(gameId: number): Promise<GameResult> {
  const {data, error} = await supabase.rpc('dispute_result', {
    p_game_id: gameId,
  });
  if (error) {
    throw fromResultError(error);
  }
  const row = oneRow(data as GameRow | GameRow[] | null);
  if (!row) {
    throw new Error('Dispute returned no row.');
  }
  return toGame(row);
}
