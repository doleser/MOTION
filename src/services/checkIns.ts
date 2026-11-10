/**
 * Check-in service: the only caller of check_in, check_out, confirm_still_here,
 * get_my_check_in and get_court_players.
 *
 * Distance, a closed court, expiry, and a second open visit are decided in
 * Postgres. This module sends the reading and does not keep it.
 */
import {fromCheckInError} from './errors';
import {supabase} from './supabase';

export interface CheckIn {
  id: number;
  courtId: number;
  checkedInAt: string;
  expiresAt: string;
  checkedOutAt: string | null;
}

/** A player at a court. Postgres only sends these to players checked in there. */
export interface CourtPlayer {
  userId: string;
  username: string;
  elo: number;
  checkedInAt: string;
}

interface CheckInRow {
  check_in_id: number;
  court_id: number;
  checked_in_at: string;
  expires_at: string;
  checked_out_at: string | null;
}

interface CourtPlayerRow {
  user_id: string;
  username: string;
  elo: number;
  checked_in_at: string;
}

function toCheckIn(row: CheckInRow): CheckIn {
  return {
    id: row.check_in_id,
    courtId: row.court_id,
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
    checkedOutAt: row.checked_out_at,
  };
}

/** Records a visit at courtId. The coordinate is not part of the result. */
export async function checkIn(
  courtId: number,
  lat: number,
  lng: number,
): Promise<CheckIn> {
  const {data, error} = await supabase.rpc('check_in', {
    p_court_id: courtId,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) {
    throw fromCheckInError(error);
  }
  if (!data) {
    throw new Error('Check-in returned no row.');
  }
  return toCheckIn(data);
}

/** Closes the signed-in player's open visit. */
export async function checkOut(): Promise<CheckIn> {
  const {data, error} = await supabase.rpc('check_out');
  if (error) {
    throw fromCheckInError(error);
  }
  if (!data) {
    throw new Error('Check-out returned no row.');
  }
  return toCheckIn(data);
}

/**
 * Answers the "Still here?" prompt. Yes keeps the visit open for another
 * 3 hours; no closes it.
 */
export async function confirmStillHere(
  checkInId: number,
  stillHere: boolean,
): Promise<CheckIn> {
  const {data, error} = await supabase.rpc('confirm_still_here', {
    p_check_in_id: checkInId,
    p_answer: stillHere,
  });
  if (error) {
    throw fromCheckInError(error);
  }
  if (!data) {
    throw new Error('Still-here answer returned no row.');
  }
  return toCheckIn(data);
}

/**
 * The signed-in player's open visit, or null if there isn't one. Call when
 * the app opens to restore state or decide whether to ask "Still here?".
 */
export async function getMyCheckIn(): Promise<CheckIn | null> {
  const {data, error} = await supabase.rpc('get_my_check_in');
  if (error) {
    throw fromCheckInError(error);
  }
  const rows = (data ?? []) as CheckInRow[];
  return rows.length > 0 ? toCheckIn(rows[0]) : null;
}

/**
 * Who is checked in at a court. Empty unless the signed-in player is checked
 * in at that same court; blocked players are left out.
 */
export async function getCourtPlayers(courtId: number): Promise<CourtPlayer[]> {
  const {data, error} = await supabase.rpc('get_court_players', {
    p_court_id: courtId,
  });
  if (error) {
    throw fromCheckInError(error);
  }
  return ((data ?? []) as CourtPlayerRow[]).map((row) => ({
    userId: row.user_id,
    username: row.username,
    elo: row.elo,
    checkedInAt: row.checked_in_at,
  }));
}
