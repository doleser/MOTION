import {useEffect, useRef} from 'react';

import {subscribeToCourtCounts, type CourtCountUpdate} from '../../services/courts';

/**
 * Listens for live player-count changes at these courts. Re-subscribes only
 * when the set of courts changes. Pass an empty list to stop listening
 * (e.g. while the screen is in the background).
 *
 * `onSynced` runs once listening starts and after each reconnect. Re-fetch
 * the counts there: changes made while not listening are never sent again.
 */
export function useCourtCounts(
  courtIds: readonly number[],
  onUpdate: (update: CourtCountUpdate) => void,
  onSynced?: () => void,
) {
  // Keep the newest callbacks without re-subscribing every render.
  const onUpdateRef = useRef(onUpdate);
  const onSyncedRef = useRef(onSynced);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onSyncedRef.current = onSynced;
  }, [onUpdate, onSynced]);

  // Same courts in a different order shouldn't re-subscribe.
  const key = [...courtIds].sort((a, b) => a - b).join(',');

  useEffect(() => {
    const ids = key === '' ? [] : key.split(',').map(Number);
    return subscribeToCourtCounts(
      ids,
      (update) => onUpdateRef.current(update),
      () => onSyncedRef.current?.(),
    );
  }, [key]);
}
