import {useState} from 'react';

import {AppButton} from '../../components/AppButton';
import {ErrorMessage} from '../../components/ErrorMessage';
import {Screen} from '../../components/Screen';
import {TextField} from '../../components/TextField';
import type {AuthScreenProps} from '../../navigation/types';
import {signInWithPassword} from '../../services/auth';
import {getErrorMessage} from '../../services/errors';

export function LoginScreen({navigation}: AuthScreenProps<'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.length > 0 && password.length > 0;

  async function handleLogin() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithPassword({email, password});
      // The root switches to Onboarding or Main on its own.
    } catch (e) {
      setError(getErrorMessage(e));
      setIsSubmitting(false);
    }
  }

  return (
    <Screen title="Log in">
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
        autoComplete="current-password"
        secureTextEntry
      />
      <ErrorMessage message={error} />
      <AppButton
        label="Log in"
        onPress={handleLogin}
        disabled={!canSubmit}
        loading={isSubmitting}
      />
      <AppButton
        label="Create an account instead"
        variant="secondary"
        onPress={() => navigation.replace('SignUp')}
      />
    </Screen>
  );
}
