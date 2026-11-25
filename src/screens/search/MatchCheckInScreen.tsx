import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, StyleSheet, View} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';
import {getChallenge, getMatchReadiness, startMatch, type Challenge} from '../../services/challenges';
import {getCourt} from '../../services/courts';
import {isResultAwaitingAnswer} from '../../services/challengeStatus';
import {getErrorMessage, isServiceError} from '../../services/errors';
import {colors} from '../../theme';
import {CheckInSheets} from '../main/CheckInSheets';
import {useCheckInFlow, type CheckInCourt} from '../main/useCheckInFlow';
import {
  MatchCheckInScreenView,
  type MatchCheckInState,
  type OpponentStatus,
} from './MatchCheckInScreenView';
import {getMatchAction, getStartOpensAt, REPORT_WINDOW_HOURS, type MatchAction} from './matchResult';
import {getMatchTiming} from './matchTime';

/** How often the screen checks the clock ("Now", match ended). */
const CLOCK_TICK_MS = 30 * 1000;

/** How often to look for the opponent at the court once the user is there. */
const OPPONENT_CHECK_MS = 15 * 1000;

/** How often to look for the opponent starting the match, or reporting a result. */
const RESULT_CHECK_MS = 10 * 1000;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

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
 *   - The main button comes from getMatchAction (matchResult.ts). START
 *     MATCH (ranked, both here, from 30 minutes before the start) calls
 *     start_match, which starts it for both players, then opens MatchResult
 *     to report. Once started, REPORT RESULT and VIEW RESULT open
 *     MatchResult. Casual matches have no result, so once both are here
 *     there's no button.
 *   - Live: a ranked match with no result is re-checked every
 *     RESULT_CHECK_MS while it can be started (so the other player's start
 *     shows up here) and once it has started (so their result does). When
 *     the opponent reports, the screen opens MatchResult by itself to
 *     confirm or dispute it.
 */
export function MatchCheckInScreen({navigation, route}: SearchScreenProps<'MatchCheckIn'>) {
  const {challengeId} = route.params;
  const isFocused = useIsFocused();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [starting, setStarting] = useState(false);
  // Why Start Match failed. Kept with the button it was for, so it stops
  // showing once the button changes (e.g. the opponent checked in).
  const [startError, setStartError] = useState<{action: MatchAction; message: string} | null>(null);

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

  // Loads when the screen comes into view, including when coming back from
  // MatchResult, so a new result shows VIEW RESULT.
  useFocusEffect(load);

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

  // A ranked match with no result yet: look for the opponent starting it
  // while it can be started, and for their result once it has started.
  // Whether it started comes from startedAt, not the clock.
  const watchForResult = match !== null && isFocused && shouldWatch(match, now);
  useEffect(() => {
    if (!watchForResult) return;
    let isCurrent = true;
    const check = () => {
      getChallenge(challengeId).then(
        (challenge) => {
          if (isCurrent) setLoaded((current) => (current?.ok ? {...current, challenge} : current));
        },
        () => {}, // Keep the last answer; the next check tries again.
      );
    };
    const timer = setInterval(check, RESULT_CHECK_MS);
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') check();
    });
    return () => {
      isCurrent = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [watchForResult, challengeId]);

  // The moment the opponent's result shows up here, open it to confirm or
  // dispute. Only on that change, so going back doesn't reopen it.
  const hadResult = useRef<boolean | null>(null);
  useEffect(() => {
    if (match === null) return;
    const hasResult = match.result !== null;
    if (hadResult.current === false && hasResult && isFocused && isResultAwaitingAnswer(match)) {
      navigation.navigate('MatchResult', {challengeId});
    }
    hadResult.current = hasResult;
  }, [match, isFocused, navigation, challengeId]);

  const action = state.kind === 'loaded' ? state.action : null;
  const actionError = startError !== null && startError.action === action ? startError.message : null;

  // START MATCH: starts it for both players, then opens the report screen.
  // `starting` blocks a second tap until the answer comes back.
  async function handleStartMatch() {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const challenge = await startMatch(challengeId);
      setLoaded((current) => (current?.ok ? {...current, challenge} : current));
      navigation.navigate('MatchResult', {challengeId});
    } catch (e) {
      if (isServiceError(e, 'match_already_started')) {
        // The opponent tapped first: it's started for both, so carry on.
        load();
        navigation.navigate('MatchResult', {challengeId});
      } else {
        setStartError({action: 'start_match', message: getErrorMessage(e)});
        // The match may have changed (ended, cancelled): show what it is now.
        if (isServiceError(e, 'match_ended') || isServiceError(e, 'challenge_not_found')) load();
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <MatchCheckInScreenView
        state={state}
        onBack={() => navigation.goBack()}
        onRetry={retry}
        onCheckIn={() => flow.open('prompt')}
        onStartMatch={() => void handleStartMatch()}
        starting={starting}
        actionError={actionError}
        onOpenResult={() => navigation.navigate('MatchResult', {challengeId})}
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

/**
 * Whether to keep re-checking the match: ranked, no result, and either
 * started (until the report deadline) or startable now (from check-in
 * opening until the scheduled end).
 */
function shouldWatch(match: Challenge, now: Date): boolean {
  if (!match.ranked || match.result !== null) return false;
  const end = match.startsAt.getTime() + match.durationMinutes * MINUTE_MS;
  if (match.startedAt !== null) return now.getTime() <= end + REPORT_WINDOW_HOURS * HOUR_MS;
  return now.getTime() >= getStartOpensAt(match.startsAt).getTime() && now.getTime() < end;
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
    started: challenge.startedAt !== null,
    action: getMatchAction(
      {
        ranked: challenge.ranked,
        hasResult: challenge.result !== null,
        startsAt: challenge.startsAt,
        durationMinutes: challenge.durationMinutes,
        startedAt: challenge.startedAt,
        youCheckedIn,
        opponentReady: opponent === 'ready',
      },
      now,
    ),
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
