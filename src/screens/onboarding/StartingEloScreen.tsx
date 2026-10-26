import {useState} from 'react';
import {StyleSheet, Text} from 'react-native';

import {AppButton} from '../../components/AppButton';
import {ErrorMessage} from '../../components/ErrorMessage';
import {Screen} from '../../components/Screen';
import {colors} from '../../components/theme';
import type {AuthScreenProps} from '../../navigation/types';
import {signInWithPassword} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';
import {useOnboardingDraft} from './OnboardingDraftContext';

/**
 * Last sign-up step. The account already exists but the user isn't signed in
 * yet, so the app stays on this screen until they tap Continue.
 */
export function StartingEloScreen({
  navigation,
  route,
}: AuthScreenProps<'StartingElo'>) {
  const {draft} = useOnboardingDraft();
  const [error, setError] = useState<string | null>(null);
  const [isContinuing, setIsContinuing] = useState(false);

  async function handleContinue() {
    const {email, password} = draft;
    if (!email || !password) {
      // Shouldn't happen. The account exists, so let them log in normally.
      navigation.reset({index: 0, routes: [{name: 'Login'}]});
      return;
    }

    setError(null);
    setIsContinuing(true);
    try {
      await signInWithPassword({email, password});
      // Signing in makes the root switch to the main tabs.
    } catch (e) {
      setError(getErrorMessage(e));
      setIsContinuing(false);
    }
  }

  return (
    <Screen
      title="You're all set"
      subtitle="Your rating will settle after your first few ranked games.">
      <Text style={styles.elo}>{route.params.elo}</Text>
      <Text style={styles.label}>Starting Elo (provisional)</Text>
      <ErrorMessage message={error} />
      <AppButton label="Continue" onPress={handleContinue} loading={isContinuing} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  elo: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    color: colors.mutedText,
    textAlign: 'center',
  },
});
