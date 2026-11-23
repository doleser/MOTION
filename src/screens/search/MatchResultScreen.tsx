import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, AppState, StyleSheet, View} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';
import {getChallenge, getResultReportedAt, reportResult, type Challenge} from '../../services/challenges';
import {getErrorMessage, isServiceError} from '../../services/errors';
import {getMyProfile} from '../../services/profile';
import {confirmResult, disputeResult, getMyEloChange, previewElo, type EloChange} from '../../services/results';
import {colors} from '../../theme';
import {formatAutoConfirm, getResultStage, type ResultStage} from './matchResult';
import {
  MatchResultScreenView,
  type MatchResultState,
  type ResultPlayer,
  type StakesState,
} from './MatchResultScreenView';

/** How often to look for the other player's answer while one is expected. */
const RESULT_CHECK_MS = 10 * 1000;

/** How often the "Auto-confirms in Xh" line is worked out again. */
const CLOCK_TICK_MS = 60 * 1000;

/**
 * The views that change when the OTHER player acts, so they're re-checked:
 * Report (they may report first), Waiting (they answer), and Confirm (in
 * case it changes elsewhere).
 */
const LIVE_STAGES: readonly ResultStage[] = ['report', 'waiting', 'confirm'];

type Loaded = {ok: true; challenge: Challenge; me: ResultPlayer} | {ok: false; message: string};

/**
 * A ranked 1v1's result, opened from Start Match (or Report Result) on
 * MatchCheckIn. MatchResultScreenView draws it. Which view each player sees
 * comes from the challenge's result (getResultStage in matchResult.ts):
 *   - Report: pick who won, then reportResult (report_result). Also
 *     re-checked, so if the opponent reports first the screen moves to
 *     Confirm / Dispute by itself.
 *   - Waiting: the reporter waits; the screen re-checks the challenge every
 *     RESULT_CHECK_MS and when the app comes back, and moves on by itself
 *     when the other player confirms or disputes.
 *   - Confirm / Dispute: the other player answers with confirmResult or
 *     disputeResult (results.ts). Dispute asks first. Both are final.
 *   - Result / disputed: both players. Each one's Elo change comes from
 *     their own elo_history row for the game (getMyEloChange), so it's right
 *     even when the screen is opened again days later.
 * If both players report at once, the second gets 'result_already_posted';
 * reloading then shows the first report to confirm or dispute.
 */
export function MatchResultScreen({navigation, route}: SearchScreenProps<'MatchResult'>) {
  const {challengeId} = route.params;
  const isFocused = useIsFocused();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stakes, setStakes] = useState<StakesState>({kind: 'loading'});
  const [reportedAt, setReportedAt] = useState<{gameId: number; at: Date} | null>(null);
  const [busy, setBusy] = useState<'confirm' | 'dispute' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // My rating change for this game, for the result view.
  const [eloChange, setEloChange] = useState<{gameId: number; change: EloChange | 'failed'} | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Loads the match and the signed-in user. Returns a cleanup that drops
  // the answer if the screen has closed.
  const load = useCallback(() => {
    let isCurrent = true;
    Promise.all([getChallenge(challengeId), getMyProfile()]).then(
      ([challenge, profile]) => {
        if (!isCurrent) return;
        const me: ResultPlayer = {
          userId: profile.userId,
          realName: profile.realName ?? profile.username ?? 'You',
          username: profile.username ?? '',
          elo: profile.elo,
        };
        setLoaded({ok: true, challenge, me});
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

  // Fetches the challenge again (keeping what's on screen if it fails).
  const refresh = useCallback(async () => {
    try {
      const challenge = await getChallenge(challengeId);
      setLoaded((current) => (current?.ok ? {...current, challenge} : current));
    } catch {
      // Keep the last answer; the next check tries again.
    }
  }, [challengeId]);

  const challenge = loaded?.ok ? loaded.challenge : null;
  const me = loaded?.ok ? loaded.me : null;
  const stage = challenge && me ? getResultStage(challenge.result, me.userId) : null;
  const opponentId = challenge?.opponent.userId ?? null;

  // The Elo stakes, for the report and confirm views.
  const needsStakes = stage === 'report' || stage === 'confirm';
  useEffect(() => {
    if (!needsStakes || opponentId === null) return;
    let isCurrent = true;
    previewElo(opponentId).then(
      (s) => {
        if (isCurrent) setStakes({kind: 'loaded', stakes: s});
      },
      () => {
        if (isCurrent) setStakes({kind: 'failed'});
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [needsStakes, opponentId]);

  // When the result was reported, for "Auto-confirms in Xh".
  const gameId = challenge?.result?.gameId ?? null;
  useEffect(() => {
    if (stage !== 'waiting' || gameId === null) return;
    let isCurrent = true;
    getResultReportedAt(gameId).then(
      (at) => {
        if (isCurrent) setReportedAt({gameId, at});
      },
      () => {},
    );
    return () => {
      isCurrent = false;
    };
  }, [stage, gameId]);

  // My Elo change, once the result is confirmed.
  useEffect(() => {
    if (stage !== 'result' || gameId === null) return;
    let isCurrent = true;
    getMyEloChange(gameId).then(
      (change) => {
        if (isCurrent) setEloChange({gameId, change: change ?? 'failed'});
      },
      () => {
        if (isCurrent) setEloChange({gameId, change: 'failed'});
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [stage, gameId]);

  // Keep the countdown moving.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // If the opponent reports while I'm still picking the winner, the screen
  // moves to Confirm / Dispute: say why, so the switch isn't a surprise.
  const previousStage = useRef<ResultStage | null>(null);
  useEffect(() => {
    if (previousStage.current === 'report' && stage === 'confirm') {
      setNotice('Your opponent already posted a result.');
    }
    previousStage.current = stage;
  }, [stage]);

  // While the other player has something to do, look for their answer.
  const isLive = stage !== null && LIVE_STAGES.includes(stage) && isFocused;
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => void refresh(), RESULT_CHECK_MS);
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [isLive, refresh]);

  // Coming back to the screen: catch up on anything that changed meanwhile.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function submit() {
    if (winnerId === null || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await reportResult(challengeId, winnerId);
      await refresh();
    } catch (e) {
      if (isServiceError(e, 'result_already_posted')) {
        // The other player reported first: show theirs to confirm or dispute.
        setNotice('Your opponent already posted a result.');
        await refresh();
      } else {
        setSubmitError(getErrorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm() {
    if (gameId === null || busy) return;
    setBusy('confirm');
    setActionError(null);
    try {
      await confirmResult(gameId);
      await refresh();
    } catch (e) {
      setActionError(getErrorMessage(e));
      // E.g. it was already answered: show where things stand now.
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function dispute() {
    if (gameId === null || busy) return;
    setBusy('dispute');
    setActionError(null);
    try {
      await disputeResult(gameId);
      await refresh();
    } catch (e) {
      setActionError(getErrorMessage(e));
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  function askToDispute() {
    // TODO: add "Disputing adds a warning. 5 warnings in a month pauses ranked
    // play for a week." once the backend records dispute warnings.
    Alert.alert('Dispute this result?', "Disputes are final. The game won't count and neither rating changes.", [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Dispute', style: 'destructive', onPress: () => void dispute()},
    ]);
  }

  function retry() {
    setLoaded(null); // Back to the spinner.
    load();
  }

  return (
    <View style={styles.root}>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <MatchResultScreenView
        state={toState(loaded, stage, {
          winnerId,
          submitting,
          submitError,
          stakes,
          reportedAt,
          now,
          busy,
          actionError,
          notice,
          eloChange,
        })}
        onBack={() => navigation.goBack()}
        onRetry={retry}
        onPickWinner={setWinnerId}
        onSubmit={() => void submit()}
        onConfirm={() => void confirm()}
        onDispute={askToDispute}
        onViewProfile={() => navigation.navigate('Profile')}
      />
    </View>
  );
}

interface ScreenExtras {
  winnerId: string | null;
  submitting: boolean;
  submitError: string | null;
  stakes: StakesState;
  reportedAt: {gameId: number; at: Date} | null;
  now: Date;
  busy: 'confirm' | 'dispute' | null;
  actionError: string | null;
  notice: string | null;
  eloChange: {gameId: number; change: EloChange | 'failed'} | null;
}

/** The screen's state from what loaded, the player's view, and local choices. */
function toState(loaded: Loaded | null, stage: ResultStage | null, extras: ScreenExtras): MatchResultState {
  if (loaded === null || stage === null) {
    return loaded?.ok === false ? {kind: 'error', message: loaded.message} : {kind: 'loading'};
  }
  if (!loaded.ok) return {kind: 'error', message: loaded.message};
  const {challenge, me} = loaded;
  const opponent: ResultPlayer = challenge.opponent;

  switch (stage) {
    case 'report':
      return {
        kind: 'report',
        me,
        opponent,
        stakes: extras.stakes,
        winnerId: extras.winnerId,
        submitting: extras.submitting,
        submitError: extras.submitError,
      };
    case 'waiting': {
      const result = challenge.result;
      if (result === null) return {kind: 'loading'}; // Can't happen: 'waiting' has a result.
      const at = extras.reportedAt?.gameId === result.gameId ? extras.reportedAt.at : null;
      return {
        kind: 'waiting',
        me,
        opponent,
        winnerId: result.winnerId,
        autoConfirmText: at ? formatAutoConfirm(at, extras.now) : null,
      };
    }
    case 'confirm': {
      const result = challenge.result;
      if (result === null) return {kind: 'loading'}; // Can't happen: 'confirm' has a result.
      return {
        kind: 'confirm',
        me,
        opponent,
        winnerId: result.winnerId,
        stakes: extras.stakes,
        busy: extras.busy,
        actionError: extras.actionError,
        notice: extras.notice,
      };
    }
    case 'result': {
      const result = challenge.result;
      if (result === null) return {kind: 'loading'}; // Can't happen: 'result' has a result.
      const loadedChange = extras.eloChange?.gameId === result.gameId ? extras.eloChange.change : 'loading';
      return {
        kind: 'result',
        me,
        opponent,
        winnerId: result.winnerId,
        // The player who didn't report is the one who confirmed.
        iConfirmed: result.reportedBy !== me.userId,
        change: loadedChange,
      };
    }
    case 'disputed': {
      const result = challenge.result;
      if (result === null) return {kind: 'loading'}; // Can't happen: 'disputed' has a result.
      // Only the player who didn't report can dispute.
      return {kind: 'disputed', opponent, iDisputed: result.reportedBy !== me.userId};
    }
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
