import {useState} from 'react';

import {AppButton} from '../../components/AppButton';
import {Checkbox} from '../../components/Checkbox';
import {ErrorMessage} from '../../components/ErrorMessage';
import {Screen} from '../../components/Screen';
import {TextField} from '../../components/TextField';
import type {AuthScreenProps} from '../../navigation/types';
import {getEmailError, getPasswordError, isEmailAvailable} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';
import {useOnboardingDraft} from '../onboarding/OnboardingDraftContext';

/**
 * First sign-up step. Checks the answers but saves nothing: the account is
 * created at the end of sign-up (HomeCourt's Finish).
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

  async function handleNext() {
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

  return (
    <Screen title="Create account">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        secureTextEntry
      />
      <Checkbox label="I'm 18 or older" checked={isAdult} onChange={setIsAdult} />
      <ErrorMessage message={error} />
      <AppButton
        label="Next"
        onPress={handleNext}
        disabled={!canContinue}
        loading={isChecking}
      />
      <AppButton
        label="I already have an account"
        variant="secondary"
        onPress={() => navigation.replace('Login')}
      />
    </Screen>
  );
}
