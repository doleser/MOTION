/**
 * The phone's location (expo-location). Used to center the map and to send
 * a reading with a check-in.
 */
import * as Location from 'expo-location';
import {Platform} from 'react-native';

import type {LatLng} from './courts';
import {getDemoLocation} from './demoLocation';

/** How long to wait for a GPS fix before giving up on a check-in reading. */
export const CHECK_IN_FIX_TIMEOUT_MS = 10000;

/** About 1.1 km north: the demo "too far" reading. */
const DEMO_TOO_FAR_OFFSET_DEG = 0.01;

/** The result of reading the location for a check-in. */
export type CheckInLocation =
  | {ok: true; coords: LatLng}
  | {
      ok: false;
      /** denied: no permission. unavailable: services off, no fix, or timeout. */
      reason: 'denied' | 'unavailable';
      /** False once the OS won't show the permission popup again. */
      canAskAgain: boolean;
    };

/**
 * A fresh reading for a check-in. Unlike getCurrentLocation it never uses a
 * cached position: an old reading could put the player at a court they
 * already left. Asks for permission if it can, and on Android offers to
 * turn location services on.
 *
 * `court` is only used by the Prototype Controls override.
 */
export async function getCheckInLocation(court: LatLng): Promise<CheckInLocation> {
  const demo = getDemoLocation();
  if (demo) {
    return demoReading(demo, court);
  }
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted' && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (permission.status !== 'granted') {
      return {ok: false, reason: 'denied', canAskAgain: permission.canAskAgain};
    }
    if (Platform.OS === 'android' && !(await Location.hasServicesEnabledAsync())) {
      // Shows the system "turn on location" dialog; throws if declined.
      await Location.enableNetworkProviderAsync();
    }
    const position = await withTimeout(
      Location.getCurrentPositionAsync({accuracy: Location.Accuracy.High}),
      CHECK_IN_FIX_TIMEOUT_MS,
    );
    if (!position) {
      return {ok: false, reason: 'unavailable', canAskAgain: true};
    }
    return {
      ok: true,
      coords: {latitude: position.coords.latitude, longitude: position.coords.longitude},
    };
  } catch {
    // Location services off, or no fix.
    return {ok: false, reason: 'unavailable', canAskAgain: true};
  }
}

function demoReading(
  demo: NonNullable<ReturnType<typeof getDemoLocation>>,
  court: LatLng,
): CheckInLocation {
  switch (demo) {
    case 'at_court':
      return {ok: true, coords: {latitude: court.latitude, longitude: court.longitude}};
    case 'too_far':
      // A real reading the server rejects, so the real error path runs.
      return {
        ok: true,
        coords: {
          latitude: court.latitude + DEMO_TOO_FAR_OFFSET_DEG,
          longitude: court.longitude,
        },
      };
    case 'denied':
      return {ok: false, reason: 'denied', canAskAgain: false};
    case 'unavailable':
      return {ok: false, reason: 'unavailable', canAskAgain: true};
  }
}

/** Resolves to null if `promise` hasn't settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Center of the UW campus: where the map opens without location access. */
export const DEFAULT_LOCATION: LatLng = {latitude: 47.6553, longitude: -122.3035};

/**
 * The phone's current position, asking for permission if it hasn't been
 * answered yet. Returns null when permission is denied or no reading is
 * available, so callers can fall back to DEFAULT_LOCATION.
 */
export async function getCurrentLocation(): Promise<LatLng | null> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    let status = current.status;
    if (status !== 'granted' && current.canAskAgain) {
      ({status} = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== 'granted') {
      return null;
    }
    // A cached reading is instant; fall back to a fresh one if there isn't one.
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced}));
    return {latitude: position.coords.latitude, longitude: position.coords.longitude};
  } catch {
    // Location services off, or no fix.
    return null;
  }
}
