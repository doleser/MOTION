import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useState} from 'react';

import type {SearchScreenProps} from '../../navigation/types';
import {sortIntoSections} from '../../services/challengeStatus';
import {listMyChallenges, type Challenge} from '../../services/challenges';
import {getErrorMessage} from '../../services/errors';
import {ChallengesInboxScreenView, type InboxState} from './ChallengesInboxScreenView';
import {usePollWhileFocused} from './usePollWhileFocused';

/**
 * How often the sections are re-sorted while the inbox is open, so a
 * challenge that expires or a match that ends moves on its own.
 */
const CLOCK_TICK_MS = 30 * 1000;

/** How often the list is reloaded while the inbox is open, to catch the other player's moves. */
const RELOAD_MS = 15 * 1000;

/** The last successful load, or why it failed. */
type Loaded = {ok: true; challenges: Challenge[]} | {ok: false; message: string};

/**
 * The challenges inbox: received, upcoming, sent, and recent challenges.
 * ChallengesInboxScreenView draws the screen.
 */
export function ChallengesInboxScreen({navigation}: SearchScreenProps<'ChallengesInbox'>) {
  const isFocused = useIsFocused();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Loads the list. Returns a cleanup that drops the answer if it arrives
  // after the screen has moved on.
  const load = useCallback(() => {
    let isCurrent = true;
    listMyChallenges()
      .then(
        (challenges) => {
          if (!isCurrent) return;
          setLoaded({ok: true, challenges});
          setNow(new Date());
        },
        (e: unknown) => {
          if (!isCurrent) return;
          // A failed reload keeps the list that's already showing.
          setLoaded((current) => (current?.ok ? current : {ok: false, message: getErrorMessage(e)}));
        },
      )
      .finally(() => {
        if (isCurrent) setIsRefreshing(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  // Load every time the inbox comes into view (including when the challenge
  // pop-up closes, so a status changed there shows here too), then every
  // RELOAD_MS and when the app comes back, so the other player's moves show
  // up without leaving the screen.
  usePollWhileFocused(load, RELOAD_MS);

  // Keep the clock moving while the inbox is showing.
  useEffect(() => {
    if (!isFocused) return;
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [isFocused]);

  function refresh() {
    setIsRefreshing(true);
    load();
  }

  function retry() {
    setLoaded(null); // Back to the spinner.
    load();
  }

  const state: InboxState =
    loaded === null
      ? {kind: 'loading'}
      : loaded.ok
        ? {kind: 'loaded', sections: sortIntoSections(loaded.challenges, now), now}
        : {kind: 'error', message: loaded.message};

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <ChallengesInboxScreenView
        state={state}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        onRetry={retry}
        onBack={() => navigation.goBack()}
        onOpenChallenge={(challengeId) => {
          // A match with a reported result opens straight to its result
          // screen (Confirm / Dispute, Waiting, or the outcome).
          const challenge = loaded?.ok ? loaded.challenges.find((c) => c.id === challengeId) : undefined;
          if (challenge?.result) {
            navigation.navigate('MatchResult', {challengeId});
          } else {
            navigation.navigate('ChallengeDetails', {challengeId});
          }
        }}
      />
    </>
  );
}
