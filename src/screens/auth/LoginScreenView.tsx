import {StyleSheet, Text, View} from 'react-native';

import {AuthLayout} from '../../components/AuthLayout';
import {MotionButton} from '../../components/MotionButton';
import {MotionField} from '../../components/MotionField';
import {colors, spacing, typography} from '../../theme';

interface LoginScreenViewProps {
  email: string;
  password: string;
  onChangeEmail: (text: string) => void;
  onChangePassword: (text: string) => void;
  /** Shown in red above the Log in button; null hides it. */
  error: string | null;
  /** False until both fields are filled. */
  canSubmit: boolean;
  /** Shows a spinner on the Log in button while signing in. */
  isSubmitting: boolean;
  onLogin: () => void;
  onSignUp: () => void;
}

/**
 * Log in screen layout. Figma: "AUTH / Login" (node 2114:46).
 *
 * UI only: it shows what it's given and reports taps. LoginScreen.tsx holds
 * the state and does the actual signing in.
 */
export function LoginScreenView({
  email,
  password,
  onChangeEmail,
  onChangePassword,
  error,
  canSubmit,
  isSubmitting,
  onLogin,
  onSignUp,
}: LoginScreenViewProps) {
  return (
    <AuthLayout gap={spacing.lg}>
      <Text style={styles.logo}>MOTION</Text>
      <Text style={styles.tagline}>FIND A COURT. GET NEXT.</Text>
      <Text style={styles.title}>{'BACK ON\nTHE COURT'}</Text>
      <Text style={styles.subtitle}>Log in to find a run and keep your record.</Text>

      <View style={styles.form}>
        <MotionField
          label="EMAIL"
          placeholder="you@example.com"
          value={email}
          onChangeText={onChangeEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <MotionField
          label="PASSWORD"
          placeholder="Enter password"
          value={password}
          onChangeText={onChangePassword}
          autoComplete="current-password"
          secureTextEntry
        />
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <MotionButton
        label="LOG IN"
        onPress={onLogin}
        disabled={!canSubmit}
        loading={isSubmitting}
      />
      <MotionButton label="NEW HERE? SIGN UP" variant="secondary" onPress={onSignUp} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  logo: {
    ...typography.display,
    color: colors.yellow,
  },
  tagline: {
    ...typography.label,
    color: colors.muted,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
  },
  /** Figma "Auth form": the two fields sit 8 apart. */
  form: {
    gap: spacing.sm,
  },
  error: {
    ...typography.body,
    color: colors.error,
  },
});
