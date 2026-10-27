import {useState} from 'react';
import {StyleSheet, Text} from 'react-native';

import {AppButton} from '../../components/AppButton';
import {ErrorMessage} from '../../components/ErrorMessage';
import {Screen} from '../../components/Screen';
import {colors} from '../../components/theme';
import {useAuth} from '../../services/AuthContext';
import {signOut} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';

export function ProfileScreen() {
  const {session, profile} = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      // The root switches back to the Login screen on its own.
    } catch (e) {
      setError(getErrorMessage(e));
      setIsSigningOut(false);
    }
  }

  return (
    <Screen title={`@${profile?.username ?? ''}`} subtitle={session?.user.email}>
      <Text style={styles.detail}>Elo: {profile?.elo}</Text>
      <ErrorMessage message={error} />
      <AppButton
        label="Sign out"
        variant="secondary"
        onPress={handleSignOut}
        loading={isSigningOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  detail: {
    fontSize: 18,
    color: colors.text,
  },
});
