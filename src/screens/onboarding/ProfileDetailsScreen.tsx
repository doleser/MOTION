import {useState} from 'react';

import {AppButton} from '../../components/AppButton';
import {Screen} from '../../components/Screen';
import {TextField} from '../../components/TextField';
import type {AuthScreenProps} from '../../navigation/types';
import {useOnboardingDraft} from './OnboardingDraftContext';

/** Turns "shooter, defender" into ['shooter', 'defender']. */
function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function ProfileDetailsScreen({
  navigation,
}: AuthScreenProps<'ProfileDetails'>) {
  const {draft, updateDraft} = useOnboardingDraft();
  const [position, setPosition] = useState(draft.position ?? '');
  const [height, setHeight] = useState(draft.heightCm?.toString() ?? '');
  const [tags, setTags] = useState(draft.tags?.join(', ') ?? '');

  const heightCm = height.length > 0 ? Number(height) : undefined;
  const heightError =
    heightCm !== undefined && !(Number.isInteger(heightCm) && heightCm > 0)
      ? 'Enter your height as a whole number of centimeters.'
      : null;

  function handleNext() {
    const parsedTags = parseTags(tags);
    updateDraft({
      position: position.trim() || undefined,
      heightCm,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    });
    navigation.navigate('SelfAssessment');
  }

  function handleSkip() {
    updateDraft({position: undefined, heightCm: undefined, tags: undefined});
    navigation.navigate('SelfAssessment');
  }

  return (
    <Screen title="About your game" subtitle="Optional. You can add these later.">
      <TextField
        label="Position"
        placeholder="e.g. Guard"
        value={position}
        onChangeText={setPosition}
      />
      <TextField
        label="Height (cm)"
        placeholder="e.g. 183"
        value={height}
        onChangeText={setHeight}
        keyboardType="number-pad"
        error={heightError}
      />
      <TextField
        label="Play style tags"
        placeholder="e.g. shooter, defender"
        value={tags}
        onChangeText={setTags}
        autoCapitalize="none"
      />
      <AppButton label="Next" onPress={handleNext} disabled={heightError !== null} />
      <AppButton label="Skip" variant="secondary" onPress={handleSkip} />
    </Screen>
  );
}
