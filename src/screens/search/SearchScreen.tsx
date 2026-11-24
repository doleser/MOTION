import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useState} from 'react';
import {Keyboard} from 'react-native';

import type {SearchScreenProps} from '../../navigation/types';
import {getPendingChallengeCount} from '../../services/challenges';
import {getErrorMessage} from '../../services/errors';
import {searchPlayers, type PlayerSearchResult} from '../../services/players';
import {parseSearchQuery} from '../../services/searchQuery';
import {SearchScreenView, type SearchStatus} from './SearchScreenView';
import {usePollWhileFocused} from './usePollWhileFocused';

/** Wait this long after the last keystroke before searching (like ChooseHandle). */
const SEARCH_DELAY_MS = 400;

/** How often the inbox badge is reloaded while this screen is open. */
const BADGE_RELOAD_MS = 15 * 1000;

/**
 * The answer to one search. `query` and `attempt` say which search it
 * answers, so an old answer is never shown for what's typed now.
 */
type SearchAnswer = {query: string; attempt: number} & (
  | {ok: true; players: PlayerSearchResult[]}
  | {ok: false; message: string}
);

/**
 * Search tab: finds players by username as the user types (~400 ms after
 * they stop), and keeps the inbox badge up to date.
 * SearchScreenView draws the screen.
 */
export function SearchScreen({navigation}: SearchScreenProps<'SearchHome'>) {
  const isFocused = useIsFocused();
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  // Bumped by "Try again" to run the same search again.
  const [attempt, setAttempt] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const parsed = parseSearchQuery(query);
  // Trimmed and lowercase, so "Joh" and "joh " don't search twice.
  const searchQuery = parsed.kind === 'ok' ? parsed.query : null;

  // Search once typing pauses. Typing again cancels the waiting search,
  // and `isCurrent` drops the answer of any search that's been replaced,
  // so a slow "jo" can never overwrite a newer "joh".
  useEffect(() => {
    if (searchQuery === null) {
      return;
    }
    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const players = await searchPlayers(searchQuery);
        if (isCurrent) {
          setAnswer({query: searchQuery, attempt, ok: true, players});
        }
      } catch (e) {
        if (isCurrent) {
          setAnswer({query: searchQuery, attempt, ok: false, message: getErrorMessage(e)});
        }
      }
    }, SEARCH_DELAY_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchQuery, attempt]);

  // Refresh the badge every time this screen comes back into view (e.g.
  // after accepting a challenge in the inbox), then every BADGE_RELOAD_MS
  // and when the app comes back, so a new challenge shows up on its own.
  const loadBadge = useCallback(() => {
    let isCurrent = true;
    getPendingChallengeCount().then(
      (count) => {
        if (isCurrent) {
          setPendingCount(count);
        }
      },
      () => {
        // The badge is a hint, not worth an error message: keep the last count.
      },
    );
    return () => {
      isCurrent = false;
    };
  }, []);
  usePollWhileFocused(loadBadge, BADGE_RELOAD_MS);

  function getStatus(): SearchStatus {
    switch (parsed.kind) {
      case 'empty':
        return {kind: 'idle'};
      case 'invalid':
        // No username can match, so there's nothing to search.
        return {kind: 'no_results', text: query.trim()};
      case 'ok': {
        // Only an answer for what's typed now (and this try) counts.
        const current =
          answer?.query === parsed.query && answer.attempt === attempt ? answer : null;
        if (!current) {
          return {kind: 'loading'};
        }
        if (!current.ok) {
          return {kind: 'error', message: current.message};
        }
        return current.players.length > 0
          ? {kind: 'results', players: current.players}
          : {kind: 'no_results', text: query.trim()};
      }
    }
  }

  function openPlayer(userId: string) {
    Keyboard.dismiss();
    navigation.navigate('PlayerProfile', {userId});
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <SearchScreenView
        query={query}
        onChangeQuery={setQuery}
        // Results update as they type, so "Search" on the keyboard just closes it.
        onSubmitQuery={Keyboard.dismiss}
        status={getStatus()}
        onRetry={() => setAttempt((n) => n + 1)}
        onSelectPlayer={openPlayer}
        pendingCount={pendingCount}
        onOpenInbox={() => navigation.navigate('ChallengesInbox')}
      />
    </>
  );
}
