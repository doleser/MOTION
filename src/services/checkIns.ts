/**
 * Check-in service: the only caller of check_in and check_out.
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

interface CheckInRow {
  check_in_id: number;
  court_id: number;
  checked_in_at: string;
  expires_at: string;
  checked_out_at: string | null;
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
