import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useState} from 'react';
import {AppState, StyleSheet, View} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';
import {getChallenge, getMatchReadiness, type Challenge} from '../../services/challenges';
import {getCourt} from '../../services/courts';
import {getErrorMessage} from '../../services/errors';
import {colors} from '../../theme';
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
 *   - The opponent's readiness comes from match_readiness, which answers
 *     only about the two players, never anyone else at the court (see
 *     useOpponentReadiness). The app only asks once the user is checked in
 *     there; before that it's "CHECK IN TO SEE".
 *   - Start Match does nothing yet (no challenges backend).
 */
export function MatchCheckInScreen({navigation, route}: SearchScreenProps<'MatchCheckIn'>) {
  const {challengeId} = route.params;
  const isFocused = useIsFocused();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [now, setNow] = useState(() => new Date());

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
  const opponent = useOpponentReadiness(youCheckedIn && isFocused ? challengeId : null);
  const state = toState(loaded, now, youCheckedIn, opponent);

  return (
    <View style={styles.root}>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <MatchCheckInScreenView
        state={state}
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
 * Whether the opponent is checked in at the match's court, asked every
 * OPPONENT_CHECK_MS. Pass null while the user isn't checked in there: the
 * rule is "you see whether your opponent is here once you check in", so the
 * answer is 'unknown'. A failed check keeps the last answer.
 */
function useOpponentReadiness(challengeId: number | null): OpponentStatus {
  const [answer, setAnswer] = useState<{challengeId: number; ready: boolean} | null>(null);

  useEffect(() => {
    if (challengeId === null) return;
    let isCurrent = true;
    const check = () => {
      getMatchReadiness(challengeId).then(
        ({opponentCheckedIn}) => {
          if (isCurrent) setAnswer({challengeId, ready: opponentCheckedIn});
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
  }, [challengeId]);

  // Until the first answer arrives, they're not there yet.
  if (challengeId === null) return 'unknown';
  if (answer?.challengeId !== challengeId) return 'not_ready';
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
