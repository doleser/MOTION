import {AppButton} from '../../components/AppButton';
import {Screen} from '../../components/Screen';
import type {AuthScreenProps} from '../../navigation/types';
import type {SkillLevel} from '../../services/profile';
import {useOnboardingDraft} from './OnboardingDraftContext';

const LEVEL_OPTIONS: {level: SkillLevel; label: string}[] = [
  {level: 'beginner', label: 'Beginner'},
  {level: 'intermediate', label: 'Intermediate'},
  {level: 'advanced', label: 'Advanced'},
];

/**
 * Sign-up step 4: the self-assessment. PLACEHOLDER layout until the design
 * is ready. Tapping a level (or Skip) saves it to the draft and moves on.
 */
export function ExperienceScreen({navigation}: AuthScreenProps<'Experience'>) {
  const {draft, updateDraft} = useOnboardingDraft();

  function choose(level: SkillLevel) {
    updateDraft({level});
    navigation.navigate('StartingElo');
  }

  return (
    <Screen
      title="How do you play?"
      subtitle="This sets your starting rating. It adjusts as you play.">
      {LEVEL_OPTIONS.map((option) => (
        <AppButton
          key={option.level}
          label={option.label}
          // Filled = the answer picked earlier (when the user comes back).
          variant={draft.level === option.level ? 'primary' : 'secondary'}
          onPress={() => choose(option.level)}
        />
      ))}
      <AppButton label="Skip" variant="secondary" onPress={() => choose('skipped')} />
    </Screen>
  );
}
