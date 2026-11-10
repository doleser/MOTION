import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';

import type {AuthScreenProps} from '../../navigation/types';
import {WelcomeScreenView} from './WelcomeScreenView';

/**
 * The first screen a signed-out user sees: Create account -> SignUp,
 * Log in -> Login. WelcomeScreenView draws the screen.
 */
export function WelcomeScreen({navigation}: AuthScreenProps<'Welcome'>) {
  // Screens stay mounted under the ones opened on top of them, so only set
  // the status bar while this screen is the one showing.
  const isFocused = useIsFocused();

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <WelcomeScreenView
        onCreateAccount={() => navigation.navigate('SignUp')}
        onLogIn={() => navigation.navigate('Login')}
      />
    </>
  );
}
