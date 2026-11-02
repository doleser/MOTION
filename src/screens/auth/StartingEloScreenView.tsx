import {Pressable, StyleSheet, Text, View} from 'react-native';

import {AuthLayout} from '../../components/AuthLayout';
import {MotionButton} from '../../components/MotionButton';
import {ScreenHeader} from '../../components/ScreenHeader';
import {SignUpProgress} from '../../components/SignUpProgress';
import {colors, opacity, sizes, spacing, typography} from '../../theme';
import {SIGN_UP_STEP_COUNT} from '../onboarding/signUpSteps';
import {CreatingAccountView} from './CreatingAccountView';

/** The answers shown in the review panel, already formatted for display. */
export interface SignUpSummary {
  /** e.g. "@johnny_1" */
  username: string;
  /** e.g. "PG"; null shows "Not added". */
  position: string | null;
  /** e.g. "6′ 2″"; null shows "Not added". */
  height: string | null;
  /** e.g. "Shooter, Playmaker"; null shows "Not added". */
  playStyles: string | null;
  /** e.g. "UW IMA"; null shows "No preference". */
  homeCourt: string | null;
}

interface StartingEloScreenViewProps {
  /** The provisional starting Elo to show. */
  elo: number;
  summary: SignUpSummary;
  /** True while the account is being created: shows the Creating account screen. */
  isCreating: boolean;
  /** Shown in red above the buttons (e.g. a network failure); null hides it. */
  error: string | null;
  onCreateAccount: () => void;
  /** EDIT EXPERIENCE: back to the self-assessment. */
  onEditExperience: () => void;
  /** Summary row taps: back to the screen that edits that answer. */
  onEditUsername: () => void;
  onEditDetails: () => void;
  onEditHomeCourt: () => void;
  onBack: () => void;
}

/**
 * Starting Elo layout. Figma: "ONBOARD / Starting rating" (node 2154:1289).
 *
 * UI only: src/screens/onboarding/StartingEloScreen.tsx builds the summary
 * from the sign-up draft and creates the account.
 *
 * Changes from Figma, agreed with the team:
 * - Step 6 of 6 (Figma predates the Home Court step).
 * - One sentence under the number explaining "provisional".
 * - No rank tier (tiers aren't defined yet).
 * - "COURT" row says "HOME COURT"; position and height share one value.
 * - Errors appear above the buttons; the demo "fail" button is left out.
 * - While creating, the whole screen is replaced by CreatingAccountView.
 */
export function StartingEloScreenView({
  elo,
  summary,
  isCreating,
  error,
  onCreateAccount,
  onEditExperience,
  onEditUsername,
  onEditDetails,
  onEditHomeCourt,
  onBack,
}: StartingEloScreenViewProps) {
  if (isCreating) {
    return <CreatingAccountView />;
  }

  // "PG · 6′ 2″", or just the one that's set, or null for neither.
  const positionAndHeight =
    [summary.position, summary.height].filter((part) => part !== null).join(' · ') ||
    null;

  return (
    <AuthLayout
      gap={spacing.md}
      header={
        <>
          <ScreenHeader title="REVIEW YOUR SETUP" onBack={onBack} />
          <SignUpProgress step={6} total={SIGN_UP_STEP_COUNT} />
        </>
      }
      footer={
        <>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <MotionButton label="CREATE ACCOUNT" onPress={onCreateAccount} />
          <MotionButton
            label="EDIT EXPERIENCE"
            variant="secondary"
            onPress={onEditExperience}
          />
        </>
      }>
      <Text style={styles.step}>06 / STARTING ELO</Text>
      <Text style={styles.title}>{'YOUR\nSTARTING POINT.'}</Text>
      <Text style={styles.subtitle}>A provisional rating—not a limit.</Text>

      <View style={styles.eloBlock}>
        <Text style={styles.eloLabel}>PROVISIONAL · SELF-ASSESSED</Text>
        <Text
          accessibilityLabel={`Starting Elo ${elo}`}
          // Stays the same size with larger phone text, so it never wraps.
          maxFontSizeMultiplier={1}
          style={styles.elo}>
          {elo}
        </Text>
        <Text style={styles.eloExplain}>
          <Text style={styles.eloExplainLead}>Provisional:</Text> your rating moves
          faster over your first few ranked games, then settles where you actually
          play.
        </Text>
      </View>

      <View style={styles.summary}>
        <ReviewRow label="USERNAME" value={summary.username} onPress={onEditUsername} />
        <ReviewRow
          label="POSITION / HEIGHT"
          value={positionAndHeight ?? 'Not added'}
          onPress={onEditDetails}
        />
        <ReviewRow
          label="PLAY STYLES"
          value={summary.playStyles ?? 'Not added'}
          onPress={onEditDetails}
        />
        <ReviewRow
          label="HOME COURT"
          value={summary.homeCourt ?? 'No preference'}
          onPress={onEditHomeCourt}
        />
      </View>

      <Text style={styles.footnote}>
        Confirmed games shape your rating. Higher ranks are earned.
      </Text>
    </AuthLayout>
  );
}

interface ReviewRowProps {
  label: string;
  value: string;
  onPress: () => void;
}

/** One tappable summary row: small label, value, and a › on the right. */
function ReviewRow({label, value, onPress}: ReviewRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint="Goes back to edit this"
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
  eloBlock: {
    gap: spacing.xs,
  },
  eloLabel: {
    ...typography.label,
    color: colors.muted,
  },
  elo: {
    ...typography.elo,
    color: colors.yellow,
  },
  eloExplain: {
    ...typography.body,
    color: colors.muted,
  },
  eloExplainLead: {
    color: colors.text,
  },
  /** Figma "Review summary": dark panel, 16 padding. */
  summary: {
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...typography.meta,
    color: colors.muted,
  },
  rowValue: {
    ...typography.ui,
    color: colors.text,
  },
  chevron: {
    ...typography.section,
    color: colors.muted,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  footnote: {
    ...typography.meta,
    color: colors.muted,
  },
  error: {
    ...typography.body,
    color: colors.error,
  },
});
