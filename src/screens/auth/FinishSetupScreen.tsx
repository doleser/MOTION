import {useState} from 'react';
import {StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {AppButton} from '../../components/AppButton';
import {ErrorMessage} from '../../components/ErrorMessage';
import {Screen} from '../../components/Screen';
import {colors} from '../../components/theme';
import {signOut} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';

/**
 * Shown when someone is signed in but has no username. Accounts are created
 * together with their profile, so this shouldn't happen; it's a safe place
 * to land if it ever does. PLACEHOLDER: for now the only way out is signing
 * out (which returns to Welcome).
 */
export function FinishSetupScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      setError(getErrorMessage(e));
      setIsSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Screen
        title="Finish setting up your account"
        subtitle="Your profile isn't complete yet. Sign out and sign up again.">
        <ErrorMessage message={error} />
        <AppButton
          label="Sign out"
          variant="secondary"
          onPress={handleSignOut}
          loading={isSigningOut}
        />
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
