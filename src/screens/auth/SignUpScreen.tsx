import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useState} from 'react';

import type {AuthScreenProps} from '../../navigation/types';
import {getEmailError, getPasswordError} from '../../services/auth';
import {useOnboardingDraft} from '../onboarding/OnboardingDraftContext';
import {SignUpScreenView} from './SignUpScreenView';

/**
 * First sign-up step. Checks the email and password FORMAT only and saves
 * them to the draft. Whether the email is already registered is only found
 * out at the end (StartingElo's Create account), which sends the user back
 * here with the message. SignUpScreenView draws the screen.
 *
 * Why not check the email here: an early "is this email registered?" check
 * would let anyone find out who has an account.
 */
export function SignUpScreen({navigation, route}: AuthScreenProps<'SignUp'>) {
  const {draft, updateDraft} = useOnboardingDraft();
  // Pre-filled from the draft when the user comes back with the Back button.
  const [email, setEmail] = useState(draft.email ?? '');
  const [password, setPassword] = useState(draft.password ?? '');
  const [isAdult, setIsAdult] = useState(draft.confirmedAdult ?? false);
  const [error, setError] = useState<string | null>(
    route.params?.errorMessage ?? null,
  );
  // Screens stay mounted under the ones opened on top of them, so only set
  // the status bar while this screen is the one showing.
  const isFocused = useIsFocused();

  // StartingElo sends the user back here if the email is already
  // registered. When new params arrive, show their message.
  // (React's recommended way to update state from changed props:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [lastParams, setLastParams] = useState(route.params);
  if (route.params !== lastParams) {
    setLastParams(route.params);
    setError(route.params?.errorMessage ?? null);
  }

  const canContinue = email.length > 0 && password.length > 0 && isAdult;

  function handleContinue() {
    // Instant checks; no server call.
    const formatError = getEmailError(email) ?? getPasswordError(password);
    if (formatError) {
      setError(formatError);
      return;
    }

    setError(null);
    updateDraft({email: email.trim(), password, confirmedAdult: true});
    navigation.navigate('ChooseHandle');
  }

  // Swaps this screen for Login instead of stacking it on top, so Back from
  // Login still returns to Welcome and the two screens never pile up.
  function goToLogin() {
    navigation.replace('Login');
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <SignUpScreenView
        email={email}
        password={password}
        isAdult={isAdult}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        onChangeIsAdult={setIsAdult}
        error={error}
        canContinue={canContinue}
        onContinue={handleContinue}
        onLogIn={goToLogin}
        // Welcome is always underneath.
        onBack={() => navigation.goBack()}
      />
    </>
  );
}
