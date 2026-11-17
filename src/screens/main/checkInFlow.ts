/**
 * The check-in overlays (Figma: OVERLAY / ...) and which one an outcome
 * leads to. Pure, so the mapping is tested without rendering.
 */
import type {CheckInLocation} from '../../services/location';
import {isServiceError} from '../../services/errors';

/** Which overlay is showing over the court screen, or none. */
export type CheckInSheet =
  | 'prompt' // Verify location
  | 'verifying' // Checking location
  | 'tooFar'
  | 'denied' // Permission denied ("Location is off")
  | 'unavailable' // Location unavailable ("Cannot verify right now")
  | 'checkOut'
  | 'expired' // Privacy expired ("Check-in required")
  | 'demo'; // Prototype Controls

/** What to do after check_in fails. */
export type CheckInFailure =
  | {kind: 'sheet'; sheet: CheckInSheet}
  /** The court closed (or isn't verified): reload it so the button says NOT AVAILABLE. */
  | {kind: 'courtUnavailable'}
  /** An open visit already exists: find out where. */
  | {kind: 'alreadyCheckedIn'}
  | {kind: 'signedOut'};

/** The overlay for a location reading that failed. */
export function sheetForLocation(
  reading: Extract<CheckInLocation, {ok: false}>,
): CheckInSheet {
  return reading.reason === 'denied' ? 'denied' : 'unavailable';
}

/**
 * Maps a check_in error to the next step. Anything unexpected (network,
 * outage) shows "Cannot verify right now": nothing changed, try again.
 */
export function failureForCheckInError(error: unknown): CheckInFailure {
  if (isServiceError(error, 'too_far')) {
    return {kind: 'sheet', sheet: 'tooFar'};
  }
  if (isServiceError(error, 'court_unavailable')) {
    return {kind: 'courtUnavailable'};
  }
  if (isServiceError(error, 'already_checked_in')) {
    return {kind: 'alreadyCheckedIn'};
  }
  if (isServiceError(error, 'not_signed_in')) {
    return {kind: 'signedOut'};
  }
  return {kind: 'sheet', sheet: 'unavailable'};
}

/** Tapping outside closes every overlay except while a check is running. */
export function isDismissible(sheet: CheckInSheet): boolean {
  return sheet !== 'verifying';
}
