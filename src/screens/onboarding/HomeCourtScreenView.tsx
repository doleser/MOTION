import {ActivityIndicator, StyleSheet, Text} from 'react-native';

import {AuthLayout} from '../../components/AuthLayout';
import {MotionButton} from '../../components/MotionButton';
import {OptionList} from '../../components/OptionList';
import {ScreenHeader} from '../../components/ScreenHeader';
import {SignUpProgress} from '../../components/SignUpProgress';
import type {Court} from '../../services/courts';
import {colors, typography} from '../../theme';
import {SIGN_UP_STEP_COUNT} from './signUpSteps';

interface HomeCourtScreenViewProps {
  /** null while the courts are loading. */
  courts: readonly Court[] | null;
  /** Shown instead of the list if loading failed; null hides it. */
  loadError: string | null;
  /** The picked court's id, or null for none. */
  homeCourtId: number | null;
  onChangeHomeCourt: (courtId: number | null) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

/**
 * Home Court layout. No Figma frame: styled like Choose Handle and Profile
 * Details. One court, optional.
 *
 * UI only: HomeCourtScreen.tsx loads the courts and saves the pick.
 */
export function HomeCourtScreenView({
  courts,
  loadError,
  homeCourtId,
  onChangeHomeCourt,
  onNext,
  onSkip,
  onBack,
}: HomeCourtScreenViewProps) {
  return (
    <AuthLayout
      header={
        <>
          <ScreenHeader title="HOME COURT" onBack={onBack} />
          <SignUpProgress step={4} total={SIGN_UP_STEP_COUNT} />
        </>
      }
      footer={
        <>
          <MotionButton label="NEXT" onPress={onNext} />
          <MotionButton label="SKIP FOR NOW" variant="secondary" onPress={onSkip} />
        </>
      }>
      <Text style={styles.step}>04 / HOME COURT</Text>
      <Text style={styles.title}>YOUR COURT.</Text>
      <Text style={styles.subtitle}>Where do you usually play? Optional.</Text>

      {loadError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {loadError}
        </Text>
      ) : courts === null ? (
        <ActivityIndicator accessibilityLabel="Loading courts" color={colors.yellow} />
      ) : (
        <OptionList
          // OptionList works with text ids; court ids are numbers.
          options={courts.map((court) => ({id: String(court.id), label: court.name}))}
          selectedId={homeCourtId === null ? null : String(homeCourtId)}
          onChange={(id) => onChangeHomeCourt(id === null ? null : Number(id))}
        />
      )}

      <Text style={styles.note}>A home court is not a check-in.</Text>
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
  error: {
    ...typography.body,
    color: colors.error,
  },
  note: {
    ...typography.meta,
    color: colors.muted,
  },
});
