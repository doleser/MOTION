import * as Location from 'expo-location';
import {useState} from 'react';
import {StyleSheet, Text} from 'react-native';

import {AppButton} from '../../components/AppButton';
import {ErrorMessage} from '../../components/ErrorMessage';
import {Screen} from '../../components/Screen';
import {colors} from '../../components/theme';
import type {AuthScreenProps} from '../../navigation/types';
import {createAccount} from '../../services/account';
import {useAuth} from '../../services/AuthContext';
import {
  getErrorMessage,
  isServiceError,
  type ServiceErrorCode,
} from '../../services/errors';
import {STARTING_ELO_BY_LEVEL} from '../../services/profile';
import {useOnboardingDraft} from './OnboardingDraftContext';

/** Problems with SignUp's answers: send the user back there to fix them. */
const SIGN_UP_ERRORS: readonly ServiceErrorCode[] = [
  'email_taken',
  'underage',
  'invalid_email',
  'weak_password',
];

/** Problems with ChooseHandle's answer. */
const USERNAME_ERRORS: readonly ServiceErrorCode[] = [
  'username_taken',
  'invalid_username',
];

/**
 * Asks for "while using the app" location. The answer doesn't matter here:
 * allowed, denied, or even an error, the user still goes on to the map.
 */
async function askForLocation(): Promise<void> {
  try {
    await Location.requestForegroundPermissionsAsync();
  } catch {
    // The map can ask again later; never block finishing sign-up.
  }
}

/**
 * Last sign-up step. PLACEHOLDER layout until the design is ready.
 *
 * Shows a PREVIEW of the starting Elo from the level in the draft. "Create
 * account" saves everything in one call, signs the user in, asks for
 * location, then lets the root switch to the map.
 */
export function StartingEloScreen({navigation}: AuthScreenProps<'StartingElo'>) {
  const {draft} = useOnboardingDraft();
  const {setFinishingSignUp} = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const previewElo = STARTING_ELO_BY_LEVEL[draft.level ?? 'skipped'];

  async function handleCreateAccount() {
    const {email, password, confirmedAdult, username, level, ...details} = draft;
    // Shouldn't happen: earlier steps always fill these. Go back to be safe.
    if (!email || !password || !confirmedAdult) {
      navigation.popTo('SignUp');
      return;
    }
    if (!username) {
      navigation.popTo('ChooseHandle');
      return;
    }

    setError(null);
    setIsCreating(true);
    // Keep these screens up after sign-in, until location is answered.
    setFinishingSignUp(true);

    try {
      await createAccount({
        email,
        password,
        confirmedAdult,
        username,
        level: level ?? 'skipped',
        ...details,
      });
    } catch (e) {
      setFinishingSignUp(false);
      setIsCreating(false);
      // Send the user to the screen that can fix it; the draft keeps
      // every other answer.
      if (isServiceError(e) && SIGN_UP_ERRORS.includes(e.code)) {
        navigation.popTo('SignUp', {errorMessage: e.message});
      } else if (isServiceError(e) && USERNAME_ERRORS.includes(e.code)) {
        navigation.popTo('ChooseHandle', {errorMessage: e.message});
      } else {
        setError(getErrorMessage(e));
      }
      return;
    }

    // Signed in now. Ask for location, then let the root switch to the map
    // (which also removes these screens and the draft).
    await askForLocation();
    setFinishingSignUp(false);
  }

  return (
    <Screen
      title="Your starting Elo"
      subtitle="Provisional: it settles after your first few ranked games.">
      <Text style={styles.elo}>{previewElo}</Text>
      <Text style={styles.label}>Starting Elo (provisional)</Text>
      <ErrorMessage message={error} />
      <AppButton
        label="Create account"
        onPress={handleCreateAccount}
        loading={isCreating}
      />
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
