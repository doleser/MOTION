import {StyleSheet, Text, View} from 'react-native';

import {AuthLayout} from '../../components/AuthLayout';
import {MotionButton} from '../../components/MotionButton';
import {MotionCheckbox} from '../../components/MotionCheckbox';
import {MotionField} from '../../components/MotionField';
import {ScreenHeader} from '../../components/ScreenHeader';
import {colors, spacing, typography} from '../../theme';

interface SignUpScreenViewProps {
  email: string;
  password: string;
  isAdult: boolean;
  onChangeEmail: (text: string) => void;
  onChangePassword: (text: string) => void;
  onChangeIsAdult: (checked: boolean) => void;
  /** Shown in red above the Continue button; null hides it. */
  error: string | null;
  /** False until both fields are filled and the box is checked. */
  canContinue: boolean;
  /** Shows a spinner on the Continue button while the email is checked. */
  isChecking: boolean;
  onContinue: () => void;
  onLogIn: () => void;
  onBack: () => void;
}

/**
 * Sign up screen layout. Figma: "AUTH / Signup" (node 2114:79).
 *
 * Two changes from Figma, both agreed by the team:
 * - An "I'm 18 or older" checkbox instead of the "DATE OF BIRTH" field.
 * - The main button says "CONTINUE", not "CREATE ACCOUNT": the account is
 *   only created at the end of sign-up (HomeCourt's Finish).
 *
 * UI only: it shows what it's given and reports taps. SignUpScreen.tsx holds
 * the state and does the checks.
 */
export function SignUpScreenView({
  email,
  password,
  isAdult,
  onChangeEmail,
  onChangePassword,
  onChangeIsAdult,
  error,
  canContinue,
  isChecking,
  onContinue,
  onLogIn,
  onBack,
}: SignUpScreenViewProps) {
  return (
    <AuthLayout
      gap={spacing.md}
      header={<ScreenHeader title="MOTION / CREATE ACCOUNT" onBack={onBack} />}>
      <Text style={styles.step}>01 / CREATE ACCOUNT</Text>
      <Text style={styles.title}>{'GET IN\nTHE GAME.'}</Text>
      <Text style={styles.subtitle}>Create an account, then set up your player card.</Text>

      <View style={styles.fields}>
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
          autoComplete="new-password"
          secureTextEntry
        />
        <MotionCheckbox label="I'm 18 or older" checked={isAdult} onChange={onChangeIsAdult} />
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <MotionButton
        label="CONTINUE"
        onPress={onContinue}
        disabled={!canContinue}
        loading={isChecking}
      />
      <MotionButton label="ALREADY A MEMBER? LOG IN" variant="secondary" onPress={onLogIn} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  step: {
    ...typography.label,
    color: colors.yellow,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
  },
  /** Figma "Signup fields": items sit 4 apart. */
  fields: {
    gap: spacing.xs,
  },
  error: {
    ...typography.body,
    color: colors.error,
  },
});
