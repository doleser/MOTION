import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useState} from 'react';

import type {AuthScreenProps} from '../../navigation/types';
import {getEmailError, getPasswordError, isEmailAvailable} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';
import {useOnboardingDraft} from '../onboarding/OnboardingDraftContext';
import {SignUpScreenView} from './SignUpScreenView';

/**
 * First sign-up step. Checks the answers but saves nothing: the account is
 * created at the end of sign-up (HomeCourt's Finish). SignUpScreenView draws
 * the screen.
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
  const [isChecking, setIsChecking] = useState(false);
  // Screens stay mounted under the ones opened on top of them, so only set
  // the status bar while this screen is the one showing.
  const isFocused = useIsFocused();

  // HomeCourt sends the user back here if the email was taken in the
  // meantime. When new params arrive, show their message.
  // (React's recommended way to update state from changed props:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [lastParams, setLastParams] = useState(route.params);
  if (route.params !== lastParams) {
    setLastParams(route.params);
    setError(route.params?.errorMessage ?? null);
  }

  const canContinue = email.length > 0 && password.length > 0 && isAdult;

  async function handleContinue() {
    // Instant checks first; these don't need the server.
    const formatError = getEmailError(email) ?? getPasswordError(password);
    if (formatError) {
      setError(formatError);
      return;
    }

    setError(null);
    setIsChecking(true);
    try {
      const available = await isEmailAvailable(email);
      if (!available) {
        setError('An account with this email already exists. Try logging in.');
        return;
      }
      updateDraft({email: email.trim(), password, confirmedAdult: true});
      navigation.navigate('ChooseHandle');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsChecking(false);
    }
  }

  // Login is always underneath (it's the first screen), so go back to it
  // rather than opening a second copy.
  function goToLogin() {
    navigation.popTo('Login');
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
        isChecking={isChecking}
        onContinue={handleContinue}
        onLogIn={goToLogin}
        onBack={goToLogin}
      />
    </>
  );
}
