import {StyleSheet, Text, View} from 'react-native';

import {AuthLayout} from '../../components/AuthLayout';
import {ChipGroup} from '../../components/ChipGroup';
import {HeightSlider} from '../../components/HeightSlider';
import {MotionButton} from '../../components/MotionButton';
import {ScreenHeader} from '../../components/ScreenHeader';
import {SegmentedChoice} from '../../components/SegmentedChoice';
import {SignUpProgress} from '../../components/SignUpProgress';
import {
  HEIGHT_RANGE_INCHES,
  MAX_PLAY_STYLE_TAGS,
  PLAY_STYLE_TAGS,
  POSITIONS,
  STARTING_HEIGHT_INCHES,
} from '../../services/profile';
import {colors, spacing, typography} from '../../theme';
import {SIGN_UP_STEP_COUNT} from '../onboarding/signUpSteps';

interface ProfileDetailsScreenViewProps {
  /** Picked position id (e.g. 'pg'), or null. */
  positionId: string | null;
  onChangePosition: (positionId: string | null) => void;
  /** Height in total inches, or null for "not added". */
  heightInches: number | null;
  onChangeHeight: (heightInches: number | null) => void;
  /** Picked play-style tag ids, up to MAX_PLAY_STYLE_TAGS. */
  tagIds: readonly string[];
  onChangeTags: (tagIds: string[]) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

/**
 * Profile Details layout. Figma: "ONBOARD / Your game" (node 2273:1617).
 *
 * UI only: it shows what it's given and reports taps.
 * src/screens/onboarding/ProfileDetailsScreen.tsx holds the state and saves
 * the answers to the sign-up draft.
 *
 * Changes from Figma, agreed with the team:
 * - Position: a row of 5 buttons instead of a "Not added" box.
 * - Height: a slider from 4'6" to 7'6" (snaps to whole inches).
 * - Play-style tags: chips on the screen instead of a "Choose" box.
 * - Preferred court moves to its own screen (after this one), so it's gone
 *   from here and the step label no longer says "+ COURT".
 */
export function ProfileDetailsScreenView({
  positionId,
  onChangePosition,
  heightInches,
  onChangeHeight,
  tagIds,
  onChangeTags,
  onNext,
  onSkip,
  onBack,
}: ProfileDetailsScreenViewProps) {
  return (
    <AuthLayout
      gap={spacing.md}
      header={
        <>
          <ScreenHeader title="ABOUT YOUR GAME" onBack={onBack} />
          <SignUpProgress step={3} total={SIGN_UP_STEP_COUNT} />
        </>
      }
      footer={
        <>
          <MotionButton label="NEXT" onPress={onNext} />
          <MotionButton label="SKIP FOR NOW" variant="secondary" onPress={onSkip} />
        </>
      }>
      <Text style={styles.step}>03 / YOUR GAME</Text>
      <Text style={styles.title}>YOUR GAME.</Text>
      <Text style={styles.subtitle}>Optional. You can update this later.</Text>

      <View style={styles.sections}>
        <SegmentedChoice
          label="POSITION"
          options={POSITIONS}
          selectedId={positionId}
          onChange={onChangePosition}
        />
        <HeightSlider
          label="HEIGHT"
          totalInches={heightInches}
          range={HEIGHT_RANGE_INCHES}
          startInches={STARTING_HEIGHT_INCHES}
          onChange={onChangeHeight}
        />
        <ChipGroup
          label={`PLAY STYLE TAGS · PICK UP TO ${MAX_PLAY_STYLE_TAGS}`}
          options={PLAY_STYLE_TAGS}
          selectedIds={tagIds}
          maxSelected={MAX_PLAY_STYLE_TAGS}
          onChange={onChangeTags}
        />
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
  /** Extra room between sections so each reads as its own block. */
  sections: {
    marginTop: spacing.sm,
    gap: spacing.screen,
  },
});
