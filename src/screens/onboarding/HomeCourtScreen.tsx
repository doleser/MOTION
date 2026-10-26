import {useState} from 'react';

import {AppButton} from '../../components/AppButton';
import {ErrorMessage} from '../../components/ErrorMessage';
import {Screen} from '../../components/Screen';
import type {AuthScreenProps} from '../../navigation/types';
import {createAccount} from '../../services/account';
import {
  getErrorMessage,
  isServiceError,
  type ServiceErrorCode,
} from '../../services/errors';
import {useOnboardingDraft} from './OnboardingDraftContext';

// TODO: load real nearby courts from a courts service (nearby_courts RPC).
// These match supabase/seed.sql.
const PLACEHOLDER_COURTS = [
  {id: 1, name: 'Denny Courts'},
  {id: 2, name: 'Laurelhurst Half Court'},
  {id: 3, name: 'Ravenna Park'},
  {id: 6, name: 'UW IMA'},
];

/** Errors caused by the SignUp screen's answers send the user back there. */
const SIGN_UP_SCREEN_ERRORS: ServiceErrorCode[] = [
  'underage',
  'invalid_email',
  'weak_password',
  'email_taken',
];

export function HomeCourtScreen({navigation}: AuthScreenProps<'HomeCourt'>) {
  const {draft} = useOnboardingDraft();
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /** Creates the account and profile together, in one call. */
  async function finish(homeCourtId?: number) {
    const {email, password, confirmedAdult, username, level, ...details} = draft;
    // Shouldn't happen: earlier screens always fill these. Go back to be safe.
    if (!email || !password || !confirmedAdult) {
      navigation.popTo('SignUp');
      return;
    }
    if (!username) {
      navigation.popTo('ChooseHandle');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const profile = await createAccount({
        email,
        password,
        confirmedAdult,
        profile: {username, level: level ?? 'skipped', ...details, homeCourtId},
      });
      // The account exists now, so make StartingElo the only screen in the
      // stack: there's no going "back" into sign-up after this.
      navigation.reset({
        index: 0,
        routes: [{name: 'StartingElo', params: {elo: profile.elo}}],
      });
    } catch (e) {
      setIsSaving(false);
      // Send the user to the screen where they can fix the problem.
      if (isServiceError(e, 'username_taken') || isServiceError(e, 'invalid_username')) {
        navigation.popTo('ChooseHandle', {errorMessage: e.message});
        return;
      }
      if (isServiceError(e) && SIGN_UP_SCREEN_ERRORS.includes(e.code)) {
        navigation.popTo('SignUp', {errorMessage: e.message});
        return;
      }
      setError(getErrorMessage(e));
    }
  }

  return (
    <Screen
      title="Pick a home court"
      subtitle="Where do you usually play? Optional.">
      {PLACEHOLDER_COURTS.map((court) => (
        <AppButton
          key={court.id}
          label={court.name}
          // Filled = selected. Tapping the selected court unselects it.
          variant={court.id === selectedCourtId ? 'primary' : 'secondary'}
          onPress={() =>
            setSelectedCourtId(court.id === selectedCourtId ? null : court.id)
          }
          disabled={isSaving}
        />
      ))}
      <ErrorMessage message={error} />
      <AppButton
        label="Finish"
        onPress={() => finish(selectedCourtId ?? undefined)}
        disabled={selectedCourtId === null}
        loading={isSaving}
      />
      <AppButton
        label="Skip"
        variant="secondary"
        onPress={() => finish()}
        disabled={isSaving}
      />
    </Screen>
  );
}
