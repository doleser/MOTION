import {StyleSheet, Text, View} from 'react-native';

import {AuthLayout} from '../../components/AuthLayout';
import {MotionButton} from '../../components/MotionButton';
import {MotionField} from '../../components/MotionField';
import {ScreenHeader} from '../../components/ScreenHeader';
import {SignUpProgress} from '../../components/SignUpProgress';
import {colors, typography} from '../../theme';

/** One line of feedback under the field. */
export interface HandleStatus {
  /** muted = in progress, success = available, error = invalid or taken. */
  tone: 'muted' | 'success' | 'error';
  message: string;
}

interface ChooseHandleScreenViewProps {
  username: string;
  onChangeUsername: (text: string) => void;
  /** Feedback under the field; null shows nothing (empty field). */
  status: HandleStatus | null;
  /** A free alternative to offer when the handle is taken, or null. */
  suggestion: string | null;
  onPickSuggestion: (handle: string) => void;
  /** False until the handle is valid and available. */
  canContinue: boolean;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * Choose Handle layout. Figma: "ONBOARD / Username" (node 2154:1203).
 *
 * Left out on purpose: the player card preview and SAVE & EXIT (nothing is
 * saved midway through sign-up).
 *
 * UI only: ChooseHandleScreen.tsx holds the state and runs the checks.
 */
export function ChooseHandleScreenView({
  username,
  onChangeUsername,
  status,
  suggestion,
  onPickSuggestion,
  canContinue,
  onContinue,
  onBack,
}: ChooseHandleScreenViewProps) {
  return (
    <AuthLayout
      header={
        <>
          <ScreenHeader title="CHOOSE YOUR USERNAME" onBack={onBack} />
          <SignUpProgress step={2} total={5} />
        </>
      }
      footer={<MotionButton label="NEXT" onPress={onContinue} disabled={!canContinue} />}>
      <Text style={styles.step}>02 / YOUR HANDLE</Text>
      <Text style={styles.title}>{'MAKE A\nNAME.'}</Text>
      <Text style={styles.subtitle}>This is how other players will know you.</Text>

      <View>
        <MotionField
          label="USERNAME"
          placeholder="yourname"
          value={username}
          onChangeText={onChangeUsername}
          helper="3-16 letters, numbers, or underscores. A nickname is fine."
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={16}
        />
        {status ? (
          <Text
            // Screen readers announce changes (e.g. "taken") as they happen.
            accessibilityLiveRegion="polite"
            style={[styles.status, toneStyles[status.tone]]}>
            {status.message}
            {/* e.g. "@hooper is taken. Try @hooper_1?"; tap the name to use it. */}
            {suggestion ? (
              <>
                {' Try '}
                <Text
                  accessibilityRole="link"
                  accessibilityHint="Uses this username"
                  onPress={() => onPickSuggestion(suggestion)}
                  style={styles.suggestion}>
                  @{suggestion}
                </Text>
                ?
              </>
            ) : null}
          </Text>
        ) : null}
      </View>
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
  status: {
    ...typography.body,
  },
  suggestion: {
    color: colors.yellow,
    textDecorationLine: 'underline',
  },
});

const toneStyles = StyleSheet.create({
  muted: {color: colors.muted},
  // The theme has no green; yellow is the brand's "good" color.
  success: {color: colors.yellow},
  error: {color: colors.error},
});
