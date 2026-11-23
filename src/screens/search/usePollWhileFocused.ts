import {useFocusEffect} from '@react-navigation/native';
import {useCallback} from 'react';
import {AppState} from 'react-native';

/**
 * Runs `load` when the screen comes into view, every `intervalMs` while it
 * stays in view, and when the app comes back to the foreground. Stops as
 * soon as the screen leaves view, so it costs nothing in the background.
 *
 * `load` may return a cleanup (e.g. one that drops a late answer). It's
 * called before the next run and when the screen leaves view, so only the
 * newest answer is used.
 *
 * Polling, not Supabase Realtime: Realtime would need the challenges table
 * to broadcast changes (a backend change). This can be swapped for it later
 * without changing the screens.
 *
 * `load` must be stable (wrap it in useCallback), or polling restarts on
 * every render.
 */
export function usePollWhileFocused(load: () => (() => void) | void, intervalMs: number): void {
  useFocusEffect(
    useCallback(() => {
      let cancelLast: (() => void) | void;
      const run = () => {
        cancelLast?.();
        cancelLast = load();
      };
      run();
      const timer = setInterval(run, intervalMs);
      const subscription = AppState.addEventListener('change', (appState) => {
        if (appState === 'active') run();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
        cancelLast?.();
      };
    }, [load, intervalMs]),
  );
}
