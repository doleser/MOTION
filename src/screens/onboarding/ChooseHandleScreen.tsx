import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useEffect, useState} from 'react';

import type {AuthScreenProps} from '../../navigation/types';
import {getErrorMessage} from '../../services/errors';
import {
  getAvailableUsernames,
  getUsernameError,
  isUsernameAvailable,
} from '../../services/profile';
import {ChooseHandleScreenView, type HandleStatus} from './ChooseHandleScreenView';
import {findFreeHandle} from './handleSuggestions';
import {useOnboardingDraft} from './OnboardingDraftContext';

/** Wait this long after the last keystroke before checking availability. */
const CHECK_DELAY_MS = 400;

/** The result of checking one handle. */
interface HandleCheck {
  name: string;
  result: 'available' | 'taken' | 'failed';
  /** A free alternative (only when taken), or null if none was found. */
  suggestion: string | null;
  /** Why the check failed (only when failed). */
  errorMessage?: string;
}

/** A handle createAccount said was taken, with its message. */
interface RejectedHandle {
  name: string;
  message: string;
}

/**
 * Sign-up step 2: pick a handle. Checks the format instantly and
 * availability ~400 ms after typing stops, suggests one free alternative
 * when it's taken, and saves the handle to the draft on NEXT.
 * ChooseHandleScreenView draws the screen.
 */
export function ChooseHandleScreen({
  navigation,
  route,
}: AuthScreenProps<'ChooseHandle'>) {
  const {draft, updateDraft} = useOnboardingDraft();
  // Pre-filled from the draft when the user comes back to this screen.
  const [username, setUsername] = useState(draft.username ?? '');
  const [check, setCheck] = useState<HandleCheck | null>(null);
  const [rejected, setRejected] = useState<RejectedHandle | null>(
    route.params?.errorMessage
      ? {name: draft.username ?? '', message: route.params.errorMessage}
      : null,
  );

  // StartingElo sends the user back here if their handle was taken in the
  // meantime. When new params arrive, remember which handle was rejected.
  // (React's recommended way to update state from changed props:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [lastParams, setLastParams] = useState(route.params);
  if (route.params !== lastParams) {
    setLastParams(route.params);
    const message = route.params?.errorMessage;
    setRejected(message ? {name: username, message} : null);
    // Forget the old "available" result so the handle is checked again
    // (and a free suggestion is found).
    if (message) {
      setCheck(null);
    }
  }

  // Only set the status bar while this screen is the one showing.
  const isFocused = useIsFocused();

  const formatError = username.length > 0 ? getUsernameError(username) : null;
  const rejectedName = rejected?.name ?? null;

  // Check availability once typing pauses. Typing again cancels the pending
  // check, so the service isn't called on every keystroke.
  useEffect(() => {
    if (username.length === 0 || getUsernameError(username) !== null) {
      return;
    }
    if (check?.name === username) {
      return; // Already checked.
    }

    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(username);
        // A handle createAccount rejected stays "taken", even if this quick
        // check disagrees.
        const isTaken = !available || username === rejectedName;
        // Only a handle the service says is free gets suggested.
        const suggestion = isTaken
          ? await findFreeHandle(
              username,
              getAvailableUsernames,
              rejectedName ? [rejectedName] : [],
            )
          : null;
        if (isCurrent) {
          setCheck({
            name: username,
            result: isTaken ? 'taken' : 'available',
            suggestion,
          });
        }
      } catch (e) {
        if (isCurrent) {
          setCheck({
            name: username,
            result: 'failed',
            suggestion: null,
            errorMessage: getErrorMessage(e),
          });
        }
      }
    }, CHECK_DELAY_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [username, check, rejectedName]);

  // The check result only counts if it's for what's in the field right now.
  const currentCheck = check?.name === username ? check : null;

  function getStatus(): HandleStatus | null {
    if (username.length === 0) {
      return null;
    }
    if (formatError) {
      return {tone: 'error', message: formatError};
    }
    if (!currentCheck) {
      return {tone: 'muted', message: `Checking @${username}...`};
    }
    switch (currentCheck.result) {
      case 'available':
        return {tone: 'success', message: `@${username} is available.`};
      case 'taken':
        return {
          tone: 'error',
          message:
            username === rejectedName && rejected
              ? rejected.message
              : `@${username} is taken.`,
        };
      case 'failed':
        return {tone: 'error', message: currentCheck.errorMessage ?? ''};
    }
  }

  function handlePickSuggestion(handle: string) {
    // Checked again like anything typed, in case someone took it meanwhile.
    setUsername(handle);
  }

  function handleContinue() {
    updateDraft({username});
    navigation.navigate('ProfileDetails');
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <ChooseHandleScreenView
        username={username}
        onChangeUsername={setUsername}
        status={getStatus()}
        suggestion={currentCheck?.suggestion ?? null}
        onPickSuggestion={handlePickSuggestion}
        canContinue={currentCheck?.result === 'available'}
        onContinue={handleContinue}
        onBack={() => navigation.goBack()}
      />
    </>
  );
}
