import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useState} from 'react';

import type {SearchScreenProps} from '../../navigation/types';
import {getChallengeStatus, type ChallengeStatus} from '../../services/challenges';
import {getErrorMessage} from '../../services/errors';
import {getPlayerProfile, type PlayerProfile} from '../../services/players';
import {PlayerProfileScreenView, type PlayerProfileState} from './PlayerProfileScreenView';

/** The last successful load, or why it failed. */
type Loaded =
  | {ok: true; profile: PlayerProfile; status: ChallengeStatus}
  | {ok: false; message: string};

/**
 * Another player's profile, opened from search. Loads their profile and
 * whether they can be challenged, and opens the challenge sheet.
 * PlayerProfileScreenView draws the screen.
 */
export function PlayerProfileScreen({navigation, route}: SearchScreenProps<'PlayerProfile'>) {
  const {userId, challengeSentAt} = route.params;
  const isFocused = useIsFocused();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Loads the profile and challenge status. Returns a cleanup that drops
  // the answer if it arrives after the screen has moved on.
  const load = useCallback(() => {
    let isCurrent = true;
    Promise.all([getPlayerProfile(userId), getChallengeStatus(userId)]).then(
      ([profile, status]) => {
        if (isCurrent) {
          setLoaded({ok: true, profile, status});
        }
      },
      (e: unknown) => {
        if (!isCurrent) return;
        // A failed reload keeps the profile that's already showing; if it's
        // stale, sending a challenge still gets checked on the server.
        setLoaded((current) => (current?.ok ? current : {ok: false, message: getErrorMessage(e)}));
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [userId]);

  // Load every time the screen comes into view, including when the
  // challenge sheet closes, so the button switches to CHALLENGE PENDING
  // after sending. A reload keeps the old profile on screen until the new
  // one arrives.
  useFocusEffect(load);

  // The challenge sheet sets `challengeSentAt` when it closes after sending.
  // The message shows while it's set; clearing it hides the message.
  const hideSentToast = useCallback(
    () => navigation.setParams({challengeSentAt: undefined}),
    [navigation],
  );

  function retry() {
    setLoaded(null); // Back to the spinner.
    load();
  }

  const state: PlayerProfileState =
    loaded === null
      ? {kind: 'loading'}
      : loaded.ok
        ? {kind: 'loaded', profile: loaded.profile, status: loaded.status}
        : {kind: 'error', message: loaded.message};

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <PlayerProfileScreenView
        state={state}
        onBack={() => navigation.goBack()}
        onRetry={retry}
        onChallenge={() => navigation.navigate('CreateChallenge', {opponentId: userId})}
        showSentToast={challengeSentAt !== undefined}
        onHideSentToast={hideSentToast}
      />
    </>
  );
}
