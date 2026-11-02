import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useEffect, useState} from 'react';

import type {AuthScreenProps} from '../../navigation/types';
import {type Court, listCourts} from '../../services/courts';
import {getErrorMessage} from '../../services/errors';
import {HomeCourtScreenView} from './HomeCourtScreenView';
import {useOnboardingDraft} from './OnboardingDraftContext';

/**
 * Sign-up step 4: optionally pick one home court. Saves it to the draft on
 * NEXT (or clears it on SKIP FOR NOW), then goes to Experience.
 * HomeCourtScreenView draws the screen.
 */
export function HomeCourtScreen({navigation}: AuthScreenProps<'HomeCourt'>) {
  const {draft, updateDraft} = useOnboardingDraft();
  // Pre-filled from the draft when the user comes back to this screen.
  const [homeCourtId, setHomeCourtId] = useState<number | null>(
    draft.homeCourtId ?? null,
  );
  const [courts, setCourts] = useState<Court[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Only set the status bar while this screen is the one showing.
  const isFocused = useIsFocused();

  useEffect(() => {
    // Ignore the answer if the user left the screen before it arrived.
    let isCurrent = true;
    listCourts()
      .then((loaded) => {
        if (isCurrent) setCourts(loaded);
      })
      .catch((e: unknown) => {
        if (isCurrent) setLoadError(getErrorMessage(e));
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  function handleNext() {
    updateDraft({homeCourtId: homeCourtId ?? undefined});
    navigation.navigate('Experience');
  }

  function handleSkip() {
    updateDraft({homeCourtId: undefined});
    navigation.navigate('Experience');
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <HomeCourtScreenView
        courts={courts}
        loadError={loadError}
        homeCourtId={homeCourtId}
        onChangeHomeCourt={setHomeCourtId}
        onNext={handleNext}
        onSkip={handleSkip}
        onBack={() => navigation.goBack()}
      />
    </>
  );
}
