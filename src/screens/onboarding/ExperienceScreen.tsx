import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useState} from 'react';

import type {AuthScreenProps} from '../../navigation/types';
import {
  ExperienceScreenView,
  type PickableLevel,
} from '../auth/ExperienceScreenView';
import {useOnboardingDraft} from './OnboardingDraftContext';

/**
 * Sign-up step 5: the self-assessment. Tapping a level selects it; SEE MY
 * STARTING ELO saves it to the draft and moves on. "Skip this step" saves
 * 'skipped'. ExperienceScreenView draws the screen.
 */
export function ExperienceScreen({navigation}: AuthScreenProps<'Experience'>) {
  const {draft, updateDraft} = useOnboardingDraft();
  // Pre-filled from the draft when the user comes back (a skip shows nothing picked).
  const [level, setLevel] = useState<PickableLevel | null>(
    draft.level && draft.level !== 'skipped' ? draft.level : null,
  );
  // Only set the status bar while this screen is the one showing.
  const isFocused = useIsFocused();

  function handleContinue() {
    if (level === null) return; // The button is disabled until a level is picked.
    updateDraft({level});
    navigation.navigate('StartingElo');
  }

  function handleSkip() {
    updateDraft({level: 'skipped'});
    navigation.navigate('StartingElo');
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <ExperienceScreenView
        level={level}
        onChangeLevel={setLevel}
        onContinue={handleContinue}
        onSkip={handleSkip}
        onBack={() => navigation.goBack()}
      />
    </>
  );
}
