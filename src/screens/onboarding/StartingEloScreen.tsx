import {useIsFocused} from '@react-navigation/native';
import * as Location from 'expo-location';
import {StatusBar} from 'expo-status-bar';
import {useEffect, useRef, useState} from 'react';

import {cmToInches, formatHeight} from '../../components/heightMath';
import type {AuthScreenProps} from '../../navigation/types';
import {createAccount} from '../../services/account';
import {useAuth} from '../../services/AuthContext';
import {type Court, listCourts} from '../../services/courts';
import {
  getErrorMessage,
  isServiceError,
  type ServiceErrorCode,
} from '../../services/errors';
import {PLAY_STYLE_TAGS, POSITIONS, STARTING_ELO_BY_LEVEL} from '../../services/profile';
import {type SignUpSummary, StartingEloScreenView} from '../auth/StartingEloScreenView';
import {type OnboardingDraft, useOnboardingDraft} from './OnboardingDraftContext';

/** Problems with SignUp's answers: send the user back there to fix them. */
const SIGN_UP_ERRORS: readonly ServiceErrorCode[] = [
  'email_taken',
  'underage',
  'invalid_email',
  'weak_password',
];

/** Problems with ChooseHandle's answer. */
const USERNAME_ERRORS: readonly ServiceErrorCode[] = [
  'username_taken',
  'invalid_username',
];

/**
 * Asks for "while using the app" location. The answer doesn't matter here:
 * allowed, denied, or even an error, the user still goes on to the map.
 */
async function askForLocation(): Promise<void> {
  try {
    await Location.requestForegroundPermissionsAsync();
  } catch {
    // The map can ask again later; never block finishing sign-up.
  }
}

/** Turns the draft's ids and numbers into the text the review panel shows. */
function buildSummary(draft: OnboardingDraft, courts: Court[] | null): SignUpSummary {
  const labelOf = (options: readonly {id: string; label: string}[], id: string) =>
    options.find((option) => option.id === id)?.label ?? id;

  let homeCourt: string | null = null;
  if (draft.homeCourtId !== undefined) {
    homeCourt =
      courts === null
        ? 'Loading…'
        : (courts.find((court) => court.id === draft.homeCourtId)?.name ??
          'Selected court');
  }

  return {
    username: `@${draft.username ?? ''}`,
    position: draft.position ? labelOf(POSITIONS, draft.position) : null,
    height:
      draft.heightCm === undefined ? null : formatHeight(cmToInches(draft.heightCm)),
    playStyles: draft.tags?.length
      ? draft.tags.map((id) => labelOf(PLAY_STYLE_TAGS, id)).join(', ')
      : null,
    homeCourt,
  };
}

/**
 * Last sign-up step. Shows the provisional Elo for the chosen level and a
 * summary of the answers. "Create account" saves everything in one call
 * (showing the Creating account screen meanwhile), signs the user in, asks
 * for location, then lets the root switch to the map.
 * StartingEloScreenView draws the screen.
 */
export function StartingEloScreen({navigation}: AuthScreenProps<'StartingElo'>) {
  const {draft} = useOnboardingDraft();
  const {setFinishingSignUp} = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [courts, setCourts] = useState<Court[] | null>(null);
  // Read by the "don't leave" guard below; a ref updates instantly, so the
  // guard is already off when an error sends the user to another screen.
  const isCreatingRef = useRef(false);
  const isFocused = useIsFocused();

  // Load court names for the summary (only needed if a home court was picked).
  useEffect(() => {
    if (draft.homeCourtId === undefined) return;
    let isCurrent = true;
    listCourts()
      .then((loaded) => {
        if (isCurrent) setCourts(loaded);
      })
      .catch(() => {
        // Not worth an error message: the row just says "Selected court".
        if (isCurrent) setCourts([]);
      });
    return () => {
      isCurrent = false;
    };
  }, [draft.homeCourtId]);

  // While the account is being created, block leaving this screen (back
  // swipe, Android back button), so it can't half-finish behind the user.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (isCreatingRef.current) {
        event.preventDefault();
      }
    });
  }, [navigation]);

  function setCreating(creating: boolean) {
    isCreatingRef.current = creating;
    setIsCreating(creating);
  }

  async function handleCreateAccount() {
    const {email, password, confirmedAdult, username, level, ...details} = draft;
    // Shouldn't happen: earlier steps always fill these. Go back to be safe.
    if (!email || !password || !confirmedAdult) {
      navigation.popTo('SignUp');
      return;
    }
    if (!username) {
      navigation.popTo('ChooseHandle');
      return;
    }

    setError(null);
    setCreating(true);
    // Keep these screens up after sign-in, until location is answered.
    setFinishingSignUp(true);

    try {
      await createAccount({
        email,
        password,
        confirmedAdult,
        username,
        level: level ?? 'skipped',
        ...details,
      });
    } catch (e) {
      setFinishingSignUp(false);
      setCreating(false);
      // Send the user to the screen that can fix it; the draft keeps
      // every other answer. Anything else shows above the buttons here.
      if (isServiceError(e) && SIGN_UP_ERRORS.includes(e.code)) {
        navigation.popTo('SignUp', {errorMessage: e.message});
      } else if (isServiceError(e) && USERNAME_ERRORS.includes(e.code)) {
        navigation.popTo('ChooseHandle', {errorMessage: e.message});
      } else {
        setError(getErrorMessage(e));
      }
      return;
    }

    // Signed in now. The location question pops up over the Creating
    // account screen; then the root switches to the map (which also
    // removes these screens and the draft).
    await askForLocation();
    setFinishingSignUp(false);
  }

  return (
    <>
      {/* White clock and battery on the dark screen. */}
      {isFocused ? <StatusBar style="light" /> : null}
      <StartingEloScreenView
        elo={STARTING_ELO_BY_LEVEL[draft.level ?? 'skipped']}
        summary={buildSummary(draft, courts)}
        isCreating={isCreating}
        error={error}
        onCreateAccount={handleCreateAccount}
        onEditExperience={() => navigation.popTo('Experience')}
        onEditUsername={() => navigation.popTo('ChooseHandle')}
        onEditDetails={() => navigation.popTo('ProfileDetails')}
        onEditHomeCourt={() => navigation.popTo('HomeCourt')}
        onBack={() => navigation.goBack()}
      />
    </>
  );
}
