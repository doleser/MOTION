import {AppButton} from '../../components/AppButton';
import {Screen} from '../../components/Screen';
import type {AuthScreenProps} from '../../navigation/types';

/**
 * UNUSED for now: the app opens straight to Login (the Figma design).
 * Kept until the team decides whether a separate welcome screen is needed.
 * It is not registered in AuthStack, so it can't be reached.
 */
export function WelcomeScreen({navigation}: AuthScreenProps<'Welcome'>) {
  return (
    <Screen title="Motion" subtitle="Find a run. Play on your terms.">
      <AppButton label="Get started" onPress={() => navigation.navigate('SignUp')} />
      <AppButton
        label="Log in"
        variant="secondary"
        onPress={() => navigation.navigate('Login')}
      />
    </Screen>
  );
}
