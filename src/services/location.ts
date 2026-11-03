/**
 * The phone's location (expo-location). Used to center the map and, later,
 * to send a reading with a check-in.
 */
import * as Location from 'expo-location';

import type {LatLng} from './courts';

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
