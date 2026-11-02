import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ScreenHeader} from '../../components/ScreenHeader';
import {SignUpProgress} from '../../components/SignUpProgress';
import {colors, sizes, spacing, typography} from '../../theme';
import {SIGN_UP_STEP_COUNT} from '../onboarding/signUpSteps';

/**
 * Full screen shown while the account is being created. Figma:
 * "AUTH / Creating account" (node 2273:1804). StartingEloScreenView shows it
 * in place of itself while `isCreating` is true.
 *
 * Changes from Figma, agreed with the team:
 * - No back arrow: leaving mid-creation would still create the account.
 * - A spinner next to "CREATING…" so it doesn't look stuck.
 * - The block is centered vertically so it fits every phone size.
 * - The "Prototype simulation" note is left out (mockup only).
 */
export function CreatingAccountView() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScreenHeader title="CREATE ACCOUNT" />
      <SignUpProgress step={SIGN_UP_STEP_COUNT} total={SIGN_UP_STEP_COUNT} />

      <View style={styles.content}>
        <Text style={styles.logo}>MOTION</Text>
        <Text style={styles.title}>{'GETTING YOU\nON COURT.'}</Text>
        <Text style={styles.subtitle}>Creating your account and player profile…</Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Creating your account"
          style={styles.working}>
          <ActivityIndicator color={colors.bg} />
          <Text style={styles.workingText}>CREATING…</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.xl,
  },
  logo: {
    ...typography.display,
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
  /** Looks like Figma's loading button, but isn't tappable. */
  working: {
    minHeight: sizes.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.yellow,
  },
  workingText: {
    ...typography.ui,
    color: colors.bg,
  },
});
