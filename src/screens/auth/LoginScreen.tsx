import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useState} from 'react';

import type {AuthScreenProps} from '../../navigation/types';
import {signInWithPassword} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';
import {LoginScreenView} from './LoginScreenView';

/**
 * The first screen a signed-out user sees. Holds the form state and signs in;
 * LoginScreenView draws the screen.
 */
export function LoginScreen({navigation}: AuthScreenProps<'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Screens stay mounted under the ones opened on top of them, so only set
  // the status bar while this screen is the one showing.
  const isFocused = useIsFocused();

  const canSubmit = email.length > 0 && password.length > 0;

  async function handleLogin() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithPassword({email, password});
      // Signing in makes the root switch to the main tabs on its own.
    } catch (e) {
      setError(getErrorMessage(e));
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <LoginScreenView
        email={email}
        password={password}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        error={error}
        canSubmit={canSubmit}
        isSubmitting={isSubmitting}
        onLogin={handleLogin}
        // Opens on top, so Back (or a swipe) returns here.
        onSignUp={() => navigation.navigate('SignUp')}
      />
    </>
  );
}
