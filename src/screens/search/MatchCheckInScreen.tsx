import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';
import {getChallenge, getMatchReadiness, type Challenge, type MatchReadiness} from '../../services/challenges';
import {getErrorMessage} from '../../services/errors';
import {colors, spacing, typography} from '../../theme';
import {MatchCheckInScreenView, type MatchCheckInState} from './MatchCheckInScreenView';
import {getMatchTiming} from './matchTime';

/** How often the screen checks the clock ("Now", match ended). */
const CLOCK_TICK_MS = 30 * 1000;

type Loaded =
  | {ok: true; challenge: Challenge; readiness: MatchReadiness}
  | {ok: false; message: string};

/**
 * An accepted 1v1 match, opened from the challenge pop-up's Check In.
 * Loads the match and both players' readiness (from the challenge STUBS for
 * now). MatchCheckInScreenView draws the screen.
 *
 * Not wired yet (a later session, after Daniel's check-in flow merges):
 * the Check In and Start Match buttons, location, and live readiness updates.
 */
export function MatchCheckInScreen({navigation, route}: SearchScreenProps<'MatchCheckIn'>) {
  const {challengeId} = route.params;
  const isFocused = useIsFocused();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [preview, setPreview] = useState<Preview>('real');

  // Loads the match and readiness. Returns a cleanup that drops the answer
  // if the screen has closed.
  const load = useCallback(() => {
    let isCurrent = true;
    Promise.all([getChallenge(challengeId), getMatchReadiness(challengeId)]).then(
      ([challenge, readiness]) => {
        if (!isCurrent) return;
        setLoaded({ok: true, challenge, readiness});
        setNow(new Date());
      },
      (e: unknown) => {
        if (isCurrent) setLoaded({ok: false, message: getErrorMessage(e)});
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [challengeId]);

  useEffect(() => load(), [load]);

  // Keep the clock moving, so "Now" and "match time has passed" show up
  // while the screen is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  function retry() {
    setLoaded(null); // Back to the spinner.
    load();
  }

  const realState = toState(loaded, now);

  return (
    <View style={styles.root}>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <MatchCheckInScreenView
        state={__DEV__ ? applyPreview(realState, preview) : realState}
        onBack={() => navigation.goBack()}
        onRetry={retry}
        // Not wired yet: check-in and starting a match come in a later session.
        onCheckIn={() => {}}
        onStartMatch={() => {}}
      />
      {/* TODO: remove the state switcher when the screen is wired up. */}
      {__DEV__ ? <PreviewSwitcher current={preview} onChange={setPreview} /> : null}
    </View>
  );
}

/** The screen's state from what loaded and the time. */
function toState(loaded: Loaded | null, now: Date): MatchCheckInState {
  if (loaded === null) return {kind: 'loading'};
  if (!loaded.ok) return {kind: 'error', message: loaded.message};
  const {challenge, readiness} = loaded;
  return {
    kind: 'loaded',
    match: {
      opponent: challenge.opponent,
      courtName: challenge.court.name,
      startsAt: challenge.startsAt,
      durationMinutes: challenge.durationMinutes,
      ranked: challenge.ranked,
    },
    timing: getMatchTiming(challenge.startsAt, challenge.durationMinutes, now),
    youCheckedIn: readiness.youCheckedIn,
    opponentReady: readiness.opponentCheckedIn,
  };
}

// ---------- Development-only state switcher (TEMPORARY) ----------

/** 'real' shows the stub's data; the others force one state. */
type Preview = 'real' | 'check_in' | 'waiting' | 'ready' | 'ended' | 'loading' | 'error';

const PREVIEWS: {value: Preview; label: string}[] = [
  {value: 'real', label: 'Real'},
  {value: 'check_in', label: '1'},
  {value: 'waiting', label: '2'},
  {value: 'ready', label: '3'},
  {value: 'ended', label: '4'},
  {value: 'loading', label: 'Load'},
  {value: 'error', label: 'Err'},
];

/** The real state, with one state forced on top for checking the layout. */
function applyPreview(state: MatchCheckInState, preview: Preview): MatchCheckInState {
  if (preview === 'real') return state;
  if (preview === 'loading') return {kind: 'loading'};
  if (preview === 'error') return {kind: 'error', message: 'Something went wrong. Try again.'};
  if (state.kind !== 'loaded') return state; // Nothing to show yet.

  // States 1-3 need a match that hasn't ended.
  const timing = preview === 'ended' ? 'ended' : state.timing === 'ended' ? 'now' : state.timing;
  return {
    ...state,
    timing,
    youCheckedIn: preview === 'waiting' || preview === 'ready',
    opponentReady: preview === 'ready',
  };
}

function PreviewSwitcher({current, onChange}: {current: Preview; onChange: (p: Preview) => void}) {
  return (
    <View style={styles.switcher}>
      <Text style={styles.switcherLabel}>DEV</Text>
      {PREVIEWS.map(({value, label}) => (
        <Pressable
          key={value}
          accessibilityRole="button"
          accessibilityState={{selected: value === current}}
          onPress={() => onChange(value)}
          style={[styles.switcherButton, value === current && styles.switcherSelected]}>
          <Text style={[styles.switcherText, value === current && styles.switcherTextSelected]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  switcherLabel: {
    ...typography.meta,
    color: colors.muted,
    marginRight: spacing.xs,
  },
  switcherButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.panel,
  },
  switcherSelected: {
    backgroundColor: colors.yellow,
  },
  switcherText: {
    ...typography.meta,
    color: colors.text,
  },
  switcherTextSelected: {
    color: colors.bg,
  },
});
