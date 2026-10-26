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

export function SelfAssessmentScreen({
  navigation,
}: AuthScreenProps<'SelfAssessment'>) {
  const {updateDraft} = useOnboardingDraft();

  function choose(level: SkillLevel) {
    updateDraft({level});
    navigation.navigate('Permissions');
  }

  return (
    <Screen
      title="How do you play?"
      subtitle="This sets your starting rating. It adjusts as you play.">
      {LEVEL_OPTIONS.map((option) => (
        <AppButton
          key={option.level}
          label={option.label}
          onPress={() => choose(option.level)}
        />
      ))}
      <AppButton label="Skip" variant="secondary" onPress={() => choose('skipped')} />
    </Screen>
  );
}
