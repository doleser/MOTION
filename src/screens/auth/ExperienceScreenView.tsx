import {Pressable, StyleSheet, Text, View} from 'react-native';

import {AuthLayout} from '../../components/AuthLayout';
import {ChoiceCard} from '../../components/ChoiceCard';
import {MotionButton} from '../../components/MotionButton';
import {ScreenHeader} from '../../components/ScreenHeader';
import {SignUpProgress} from '../../components/SignUpProgress';
import type {SkillLevel} from '../../services/profile';
import {colors, opacity, spacing, typography} from '../../theme';
import {SIGN_UP_STEP_COUNT} from '../onboarding/signUpSteps';

/** The levels a player can pick (skipping is separate). */
export type PickableLevel = Exclude<SkillLevel, 'skipped'>;

/** Wording from Figma (chosen over Use Case 1's wording). */
const LEVELS: readonly {level: PickableLevel; title: string; description: string}[] = [
  {
    level: 'beginner',
    title: 'BEGINNER',
    description: 'I’m new to basketball or learning the basics.',
  },
  {
    level: 'intermediate',
    title: 'INTERMEDIATE',
    description: 'I know the rules and play casual pickup.',
  },
  {
    level: 'advanced',
    title: 'ADVANCED',
    description: 'I play regularly and know competitive pickup.',
  },
];

interface ExperienceScreenViewProps {
  /** The picked level, or null if none yet. */
  level: PickableLevel | null;
  onChangeLevel: (level: PickableLevel) => void;
  /** SEE MY STARTING ELO. Disabled until a level is picked. */
  onContinue: () => void;
  /** "Skip this step" link: goes on without a level. */
  onSkip: () => void;
  onBack: () => void;
}

/**
 * Experience (self-assessment) layout. Figma: "ONBOARD / Experience"
 * (node 2154:1240).
 *
 * UI only: src/screens/onboarding/ExperienceScreen.tsx holds the state and
 * saves the level to the sign-up draft.
 *
 * Changes from Figma, agreed with the team:
 * - Step 5 of 6 (Figma predates the Home Court step).
 * - A "Skip this step" link (Use Case 1 needs a way to skip).
 * - SAVE & EXIT left out (nothing is saved midway through sign-up).
 */
export function ExperienceScreenView({
  level,
  onChangeLevel,
  onContinue,
  onSkip,
  onBack,
}: ExperienceScreenViewProps) {
  return (
    <AuthLayout
      gap={spacing.md}
      header={
        <>
          <ScreenHeader title="HOW DO YOU PLAY?" onBack={onBack} />
          <SignUpProgress step={5} total={SIGN_UP_STEP_COUNT} />
        </>
      }
      footer={
        <MotionButton
          label="SEE MY STARTING ELO"
          onPress={onContinue}
          disabled={level === null}
        />
      }>
      <Text style={styles.step}>05 / EXPERIENCE</Text>
      <Text style={styles.title}>{'HOW DO\nYOU PLAY?'}</Text>
      <Text style={styles.subtitle}>Choose the level that feels closest to you.</Text>

      <View accessibilityRole="radiogroup" style={styles.cards}>
        {LEVELS.map((option) => (
          <ChoiceCard
            key={option.level}
            title={option.title}
            description={option.description}
            hint="TAP TO SELECT"
            selectedHint="SELECTED"
            isSelected={level === option.level}
            onPress={() => onChangeLevel(option.level)}
          />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not sure? Skip this step"
        hitSlop={spacing.md}
        onPress={onSkip}>
        {({pressed}) => (
          <Text style={[styles.skip, pressed && styles.pressed]}>
            Not sure? <Text style={styles.skipLink}>Skip this step</Text>
          </Text>
        )}
      </Pressable>

      <Text style={styles.note}>ALL-STAR IS EARNED, NOT SELECTED.</Text>
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
  cards: {
    gap: spacing.md,
  },
  skip: {
    ...typography.body,
    color: colors.muted,
  },
  skipLink: {
    color: colors.text,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: opacity.pressed,
  },
  note: {
    ...typography.label,
    color: colors.yellow,
  },
});
