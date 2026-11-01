import {useEffect, useState} from 'react';
import {ActivityIndicator} from 'react-native';

import {AppButton} from '../../components/AppButton';
import {ErrorMessage} from '../../components/ErrorMessage';
import {Screen} from '../../components/Screen';
import {TextField} from '../../components/TextField';
import type {AuthScreenProps} from '../../navigation/types';
import {type Court, listCourts} from '../../services/courts';
import {getErrorMessage} from '../../services/errors';
import {useOnboardingDraft} from './OnboardingDraftContext';

/** Turns "shooter, defender" into ['shooter', 'defender']. */
function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Sign-up step 3: optional details. PLACEHOLDER layout until the design is
 * ready (position, height, and tags become pickers then).
 */
export function ProfileDetailsScreen({
  navigation,
}: AuthScreenProps<'ProfileDetails'>) {
  const {draft, updateDraft} = useOnboardingDraft();
  const [position, setPosition] = useState(draft.position ?? '');
  const [height, setHeight] = useState(draft.heightCm?.toString() ?? '');
  const [tags, setTags] = useState(draft.tags?.join(', ') ?? '');
  const [courtIds, setCourtIds] = useState<number[]>(draft.preferredCourtIds ?? []);
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [courtsError, setCourtsError] = useState<string | null>(null);

  useEffect(() => {
    // Ignore the answer if the user left the screen before it arrived.
    let isCurrent = true;
    listCourts()
      .then((loaded) => {
        if (isCurrent) setCourts(loaded);
      })
      .catch((e: unknown) => {
        if (isCurrent) setCourtsError(getErrorMessage(e));
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const heightCm = height.length > 0 ? Number(height) : undefined;
  const heightError =
    heightCm !== undefined && !(Number.isInteger(heightCm) && heightCm > 0)
      ? 'Enter your height as a whole number of centimeters.'
      : null;

  function toggleCourt(id: number) {
    setCourtIds((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  }

  function handleNext() {
    const parsedTags = parseTags(tags);
    updateDraft({
      position: position.trim() || undefined,
      heightCm,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      preferredCourtIds: courtIds.length > 0 ? courtIds : undefined,
    });
    navigation.navigate('Experience');
  }

  function handleSkip() {
    updateDraft({
      position: undefined,
      heightCm: undefined,
      tags: undefined,
      preferredCourtIds: undefined,
    });
    navigation.navigate('Experience');
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

      {/* Preferred courts: tap to pick any number. Filled = picked. */}
      <ErrorMessage message={courtsError} />
      {courts === null && courtsError === null ? (
        <ActivityIndicator accessibilityLabel="Loading courts" />
      ) : null}
      {courts?.map((court) => (
        <AppButton
          key={court.id}
          label={court.name}
          variant={courtIds.includes(court.id) ? 'primary' : 'secondary'}
          onPress={() => toggleCourt(court.id)}
        />
      ))}

      <AppButton label="Next" onPress={handleNext} disabled={heightError !== null} />
      <AppButton label="Skip" variant="secondary" onPress={handleSkip} />
    </Screen>
  );
}
