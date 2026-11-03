import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import type {Region} from 'react-native-maps';

import {
  distanceBetween,
  getNearbyCourts,
  type CourtCountUpdate,
  type CourtPin,
  type LatLng,
} from '../../services/courts';
import {getErrorMessage} from '../../services/errors';

/** The map shows this many courts: the ones nearest the center of the screen. */
export const MAX_COURTS = 10;
/** Don't show courts farther than this from the center. */
const SEARCH_RADIUS_METERS = 20000;
/** Wait this long after the map stops moving before searching. */
const DEBOUNCE_MS = 300;
/** Search again only once the center moves this fraction of the screen width. */
const REFETCH_FRACTION = 0.15;
const METERS_PER_DEGREE = 111320;

/** Width of the visible map area in meters. */
function visibleWidthMeters(region: Region): number {
  const cosLat = Math.cos((region.latitude * Math.PI) / 180);
  return region.longitudeDelta * METERS_PER_DEGREE * cosLat;
}

/**
 * The courts nearest the center of the map. Call `loadAround` once with the
 * starting point, then pass `onRegionChangeComplete` to the MapView.
 */
export function useNearbyCourts() {
  const [courts, setCourts] = useState<CourtPin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the newest request may update the screen.
  const latestRequest = useRef(0);
  const lastCenter = useRef<LatLng | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAround = useCallback(async (center: LatLng) => {
    const requestId = ++latestRequest.current;
    lastCenter.current = center;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getNearbyCourts({
        ...center,
        radiusMeters: SEARCH_RADIUS_METERS,
        maxResults: MAX_COURTS,
      });
      if (requestId === latestRequest.current) {
        // Replace, don't merge: the map always shows the current nearest few.
        setCourts(result);
      }
    } catch (e) {
      if (requestId === latestRequest.current) {
        setError(getErrorMessage(e));
      }
    } finally {
      if (requestId === latestRequest.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const onRegionChangeComplete = useCallback(
    (region: Region) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        const center = {latitude: region.latitude, longitude: region.longitude};
        const last = lastCenter.current;
        // A small pan or a zoom keeps nearly the same nearest courts.
        if (last && distanceBetween(last, center) < visibleWidthMeters(region) * REFETCH_FRACTION) {
          return;
        }
        loadAround(center);
      }, DEBOUNCE_MS);
    },
    [loadAround],
  );

  /** Search again around the last center, e.g. after an error. */
  const refresh = useCallback(() => {
    if (lastCenter.current) {
      loadAround(lastCenter.current);
    }
  }, [loadAround]);

  /** Apply a live player-count change to one court. */
  const updateCount = useCallback(({courtId, playerCount}: CourtCountUpdate) => {
    setCourts((current) =>
      current.map((court) => (court.id === courtId ? {...court, playerCount} : court)),
    );
  }, []);

  // Counts may be stale after the app was in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(
    () => () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    },
    [],
  );

  return {courts, isLoading, error, loadAround, onRegionChangeComplete, refresh, updateCount};
}
