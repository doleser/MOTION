import {useCallback, useEffect, useState} from 'react';
import {Alert} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';
import {getCheckInOpensAt, getDisplayStatus, isCheckInOpen} from '../../services/challengeStatus';
import {
  acceptChallenge,
  cancelChallenge,
  declineChallenge,
  getChallenge,
  previewElo,
  type Challenge,
  type EloStakes,
} from '../../services/challenges';
import {getErrorMessage, isServiceError} from '../../services/errors';
import {
  ChallengeDetailsScreenView,
  type BusyAction,
  type DetailsState,
} from './ChallengeDetailsScreenView';
import {formatClockTime, formatMatchTime} from './matchTime';

/** How often the pop-up checks the clock (expiry, check-in opening). */
const CLOCK_TICK_MS = 30 * 1000;

type Loaded = {ok: true; challenge: Challenge} | {ok: false; message: string};

/**
 * One challenge, as a sheet over the inbox. Loads it, runs Accept, Decline,
 * and Cancel (with a confirmation where agreed), and opens check-in.
 * ChallengeDetailsScreenView draws the sheet.
 */
export function ChallengeDetailsScreen({navigation, route}: SearchScreenProps<'ChallengeDetails'>) {
  const {challengeId} = route.params;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [stakes, setStakes] = useState<EloStakes | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Loads the challenge. Returns a cleanup that drops the answer if the
  // sheet has closed.
  const load = useCallback(() => {
    let isCurrent = true;
    getChallenge(challengeId).then(
      (challenge) => {
        if (!isCurrent) return;
        setLoaded({ok: true, challenge});
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

  // Ranked only: load the Elo stakes once the opponent is known.
  const opponentId = loaded?.ok && loaded.challenge.ranked ? loaded.challenge.opponent.userId : null;
  useEffect(() => {
    if (!opponentId) return;
    let isCurrent = true;
    previewElo(opponentId).then(
      (loadedStakes) => {
        if (isCurrent) setStakes(loadedStakes);
      },
      () => {
        // The line says "Elo stakes unavailable." instead.
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [opponentId]);

  // Keep the clock moving, so a challenge expires or check-in opens while
  // the sheet is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  /** Runs one action; on success shows the new status in place. */
  async function run(action: Exclude<BusyAction, null>, call: (id: number) => Promise<Challenge>) {
    setActionError(null);
    setBusyAction(action);
    try {
      const updated = await call(challengeId);
      setLoaded({ok: true, challenge: updated});
      setNow(new Date());
    } catch (e) {
      setActionError(getErrorMessage(e));
      // If the other player acted first (or it expired), show its real status.
      if (
        isServiceError(e, 'challenge_expired') ||
        isServiceError(e, 'challenge_already_answered') ||
        isServiceError(e, 'match_ended')
      ) {
        load();
      }
    } finally {
      setBusyAction(null);
    }
  }

  function confirmDecline() {
    Alert.alert('Decline this challenge?', undefined, [
      {text: 'Keep it', style: 'cancel'},
      {text: 'Decline', style: 'destructive', onPress: () => void run('decline', declineChallenge)},
    ]);
  }

  function confirmCancel(isMatch: boolean) {
    Alert.alert(isMatch ? 'Cancel this match?' : 'Cancel this challenge?', undefined, [
      {text: 'Keep it', style: 'cancel'},
      {
        text: isMatch ? 'Cancel match' : 'Cancel challenge',
        style: 'destructive',
        onPress: () => void run('cancel', cancelChallenge),
      },
    ]);
  }

  function openCheckIn() {
    // A screen opened from a sheet would appear inside the sheet, so close
    // the sheet first; check-in then opens on top of the inbox.
    navigation.goBack();
    navigation.navigate('MatchCheckIn', {challengeId});
  }

  function retryLoad() {
    setLoaded(null);
    load();
  }

  let state: DetailsState;
  if (loaded === null) {
    state = {kind: 'loading'};
  } else if (!loaded.ok) {
    state = {kind: 'error', message: loaded.message};
  } else {
    const {challenge} = loaded;
    const opensAt = getCheckInOpensAt(challenge);
    const sameDay = opensAt.toDateString() === now.toDateString();
    state = {
      kind: 'loaded',
      challenge,
      status: getDisplayStatus(challenge, now),
      checkInOpen: isCheckInOpen(challenge, now),
      // "5:30 PM" today, or the full date on another day.
      checkInOpensAt: sameDay ? formatClockTime(opensAt) : formatMatchTime(opensAt),
      stakes,
    };
  }

  const status = state.kind === 'loaded' ? state.status : null;

  return (
    <ChallengeDetailsScreenView
      state={state}
      onRetryLoad={retryLoad}
      busyAction={busyAction}
      actionError={actionError}
      onAccept={() => void run('accept', acceptChallenge)}
      onDecline={confirmDecline}
      onCancel={() => confirmCancel(status === 'confirmed')}
      onCheckIn={openCheckIn}
    />
  );
}
