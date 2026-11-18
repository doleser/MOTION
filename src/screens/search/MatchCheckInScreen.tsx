import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useState} from 'react';
import {AppState, Pressable, StyleSheet, Text, View} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';
import {getChallenge, type Challenge} from '../../services/challenges';
import {getCourtPlayers} from '../../services/checkIns';
import {getCourt} from '../../services/courts';
import {getErrorMessage} from '../../services/errors';
import {colors, spacing, typography} from '../../theme';
import {CheckInSheets} from '../main/CheckInSheets';
import {useCheckInFlow, type CheckInCourt} from '../main/useCheckInFlow';
import {
  MatchCheckInScreenView,
  type MatchCheckInState,
  type OpponentStatus,
} from './MatchCheckInScreenView';
import {getMatchTiming} from './matchTime';

/** How often the screen checks the clock ("Now", match ended). */
const CLOCK_TICK_MS = 30 * 1000;

/** How often to look for the opponent at the court once the user is there. */
const OPPONENT_CHECK_MS = 15 * 1000;

type Loaded = {ok: true; challenge: Challenge; court: CheckInCourt} | {ok: false; message: string};

/**
 * An accepted 1v1 match, opened from the challenge pop-up's Check In.
 * MatchCheckInScreenView draws the screen.
 *
 *   - Check In runs the same check-in flow and sheets as Court Details
 *     (useCheckInFlow / CheckInSheets), at the match's court.
 *   - "YOU · CHECKED IN" is real: the user's open visit is at this court.
 *   - The opponent's readiness follows the app's privacy rule: a player
 *     only sees who's checked in at a court once they're checked in there
 *     too. So once the user is checked in, get_court_players shows whether
 *     the opponent is there (see useOpponentAtCourt); before that it's
 *     "CHECK IN TO SEE". This is the intended design, not a stand-in.
 *   - Start Match does nothing yet (no challenges backend).
 */
export function MatchCheckInScreen({navigation, route}: SearchScreenProps<'MatchCheckIn'>) {
  const {challengeId} = route.params;
  const isFocused = useIsFocused();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [preview, setPreview] = useState<Preview>('real');

  // Loads the match and its court. Returns a cleanup that drops the answer
  // if the screen has closed.
  const load = useCallback(() => {
    let isCurrent = true;
    loadMatch(challengeId).then(
      ({challenge, court}) => {
        if (!isCurrent) return;
        setLoaded({ok: true, challenge, court});
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

  // Daniel's check-in flow, pointed at the match's court. After a check-in
  // the user stays here; the YOU line updates from flow.myCheckIn.
  const flow = useCheckInFlow({
    court: loaded?.ok ? loaded.court : null,
    onCheckedIn: () => {},
    onCourtUnavailable: load,
  });
  const {refreshMyCheckIn} = flow;

  // Whether the user is checked in here decides "YOU · CHECKED IN": ask
  // again when the screen comes into view and when the app comes back.
  useFocusEffect(
    useCallback(() => {
      void refreshMyCheckIn();
    }, [refreshMyCheckIn]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshMyCheckIn();
    });
    return () => subscription.remove();
  }, [refreshMyCheckIn]);

  function retry() {
    setLoaded(null); // Back to the spinner.
    load();
  }

  const match = loaded?.ok ? loaded.challenge : null;
  const youCheckedIn = match !== null && flow.myCheckIn?.courtId === match.court.id;
  const opponent = useOpponentAtCourt(
    youCheckedIn && isFocused ? match.court.id : null,
    match?.opponent.userId ?? null,
  );
  const realState = toState(loaded, now, youCheckedIn, opponent);

  return (
    <View style={styles.root}>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <MatchCheckInScreenView
        state={__DEV__ ? applyPreview(realState, preview) : realState}
        onBack={() => navigation.goBack()}
        onRetry={retry}
        onCheckIn={() => flow.open('prompt')}
        // Not wired yet: needs the challenges backend.
        onStartMatch={() => {}}
      />
      <CheckInSheets
        flow={flow}
        courtName={loaded?.ok ? loaded.court.name : ''}
        // BACK TO MAP: switch to the Map tab.
        onBackToMap={() => navigation.navigate('Map', {screen: 'MapHome'})}
      />
      {/* TODO: remove the state switcher when the screen is wired up. */}
      {__DEV__ ? <PreviewSwitcher current={preview} onChange={setPreview} /> : null}
    </View>
  );
}

/** The match, and its court's location (the check-in flow needs it). */
async function loadMatch(challengeId: number): Promise<{challenge: Challenge; court: CheckInCourt}> {
  const challenge = await getChallenge(challengeId);
  const court = await getCourt(challenge.court.id);
  return {
    challenge,
    court: {id: court.id, name: court.name, latitude: court.latitude, longitude: court.longitude},
  };
}

/**
 * Whether the opponent is checked in at `courtId`, asked every
 * OPPONENT_CHECK_MS. Pass a null courtId while the user isn't checked in
 * there: get_court_players only answers players at that same court, so the
 * answer is 'unknown'. A failed check keeps the last answer.
 */
function useOpponentAtCourt(courtId: number | null, opponentId: string | null): OpponentStatus {
  const [answer, setAnswer] = useState<{courtId: number; ready: boolean} | null>(null);

  useEffect(() => {
    if (courtId === null || opponentId === null) return;
    let isCurrent = true;
    const check = () => {
      getCourtPlayers(courtId).then(
        (players) => {
          if (isCurrent) {
            setAnswer({courtId, ready: players.some((p) => p.userId === opponentId)});
          }
        },
        () => {},
      );
    };
    check();
    const timer = setInterval(check, OPPONENT_CHECK_MS);
    return () => {
      isCurrent = false;
      clearInterval(timer);
    };
  }, [courtId, opponentId]);

  // Until the first answer for this court arrives, they're not there yet.
  if (courtId === null) return 'unknown';
  if (answer?.courtId !== courtId) return 'not_ready';
  return answer.ready ? 'ready' : 'not_ready';
}

/** The screen's state from what loaded, the time, and both players' check-ins. */
function toState(
  loaded: Loaded | null,
  now: Date,
  youCheckedIn: boolean,
  opponent: OpponentStatus,
): MatchCheckInState {
  if (loaded === null) return {kind: 'loading'};
  if (!loaded.ok) return {kind: 'error', message: loaded.message};
  const {challenge} = loaded;
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
    youCheckedIn,
    opponent,
  };
}

// ---------- Development-only state switcher (TEMPORARY) ----------

/**
 * 'real' shows the real data; the others force a state real data can't
 * reach yet: 3 (both ready) needs a real opponent, so real challenges, and
 * 4 (match time passed) needs waiting until the match ends. States 1 and 2,
 * loading, and errors can all be reached for real.
 */
type Preview = 'real' | 'ready' | 'ended';

const PREVIEWS: {value: Preview; label: string}[] = [
  {value: 'real', label: 'Real'},
  {value: 'ready', label: '3'},
  {value: 'ended', label: '4'},
];

/** The real state, with one state forced on top for checking the layout. */
function applyPreview(state: MatchCheckInState, preview: Preview): MatchCheckInState {
  if (preview === 'real' || state.kind !== 'loaded') return state;
  if (preview === 'ended') return {...state, timing: 'ended'};
  // State 3 needs a match that hasn't ended.
  return {
    ...state,
    timing: state.timing === 'ended' ? 'now' : state.timing,
    youCheckedIn: true,
    opponent: 'ready',
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
