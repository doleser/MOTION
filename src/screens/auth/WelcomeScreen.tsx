import {AppButton} from '../../components/AppButton';
import {Screen} from '../../components/Screen';
import type {AuthScreenProps} from '../../navigation/types';

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
