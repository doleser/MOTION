import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useState} from 'react';

import {cmToInches, inchesToCm} from '../../components/heightMath';
import type {AuthScreenProps} from '../../navigation/types';
import {ProfileDetailsScreenView} from '../auth/ProfileDetailsScreenView';
import {useOnboardingDraft} from './OnboardingDraftContext';

/**
 * Sign-up step 3: optional position, height, and play-style tags. Saves
 * them to the draft on NEXT (or clears them on SKIP FOR NOW), then goes to
 * HomeCourt. ProfileDetailsScreenView draws the screen.
 */
export function ProfileDetailsScreen({
  navigation,
}: AuthScreenProps<'ProfileDetails'>) {
  const {draft, updateDraft} = useOnboardingDraft();
  // Pre-filled from the draft when the user comes back to this screen.
  const [positionId, setPositionId] = useState<string | null>(draft.position ?? null);
  const [heightInches, setHeightInches] = useState<number | null>(
    draft.heightCm === undefined ? null : cmToInches(draft.heightCm),
  );
  const [tagIds, setTagIds] = useState<string[]>(draft.tags ?? []);
  // Screens stay mounted under the ones opened on top of them, so only set
  // the status bar while this screen is the one showing.
  const isFocused = useIsFocused();

  function handleNext() {
    updateDraft({
      position: positionId ?? undefined,
      // Saved as whole centimeters.
      heightCm: heightInches === null ? undefined : inchesToCm(heightInches),
      tags: tagIds.length > 0 ? tagIds : undefined,
    });
    navigation.navigate('HomeCourt');
  }

  function handleSkip() {
    updateDraft({position: undefined, heightCm: undefined, tags: undefined});
    navigation.navigate('HomeCourt');
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <ProfileDetailsScreenView
        positionId={positionId}
        onChangePosition={setPositionId}
        heightInches={heightInches}
        onChangeHeight={setHeightInches}
        tagIds={tagIds}
        onChangeTags={setTagIds}
        onNext={handleNext}
        onSkip={handleSkip}
        onBack={() => navigation.goBack()}
      />
    </>
  );
}
