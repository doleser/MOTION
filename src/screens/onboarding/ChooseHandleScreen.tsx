import {useState} from 'react';

import {AppButton} from '../../components/AppButton';
import {Screen} from '../../components/Screen';
import {TextField} from '../../components/TextField';
import type {AuthScreenProps} from '../../navigation/types';
import {getErrorMessage} from '../../services/errors';
import {getUsernameError, isUsernameAvailable} from '../../services/profile';
import {useOnboardingDraft} from './OnboardingDraftContext';

export function ChooseHandleScreen({
  navigation,
  route,
}: AuthScreenProps<'ChooseHandle'>) {
  const {draft, updateDraft} = useOnboardingDraft();
  const [username, setUsername] = useState(draft.username ?? '');
  const [serverError, setServerError] = useState<string | null>(
    route.params?.errorMessage ?? null,
  );
  const [isChecking, setIsChecking] = useState(false);

  // HomeCourt sends the user back here with a message if their username was
  // taken in the meantime. When new params arrive, show their message.
  // (React's recommended way to update state from changed props:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [lastParams, setLastParams] = useState(route.params);
  if (route.params !== lastParams) {
    setLastParams(route.params);
    setServerError(route.params?.errorMessage ?? null);
  }

  // Instant format check while typing; no server call needed.
  const formatError = username.length > 0 ? getUsernameError(username) : null;

  function handleChangeText(text: string) {
    setUsername(text);
    setServerError(null);
  }

  async function handleNext() {
    setServerError(null);
    setIsChecking(true);
    try {
      const available = await isUsernameAvailable(username);
      if (!available) {
        setServerError('That username is taken. Try another.');
        return;
      }
      updateDraft({username});
      navigation.navigate('ProfileDetails');
    } catch (e) {
      setServerError(getErrorMessage(e));
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <Screen
      title="Choose a username"
      subtitle="This is how other players will see you.">
      <TextField
        label="Username"
        value={username}
        onChangeText={handleChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={16}
        error={formatError ?? serverError}
      />
      <AppButton
        label="Next"
        onPress={handleNext}
        disabled={username.length === 0 || formatError !== null}
        loading={isChecking}
      />
    </Screen>
  );
}
