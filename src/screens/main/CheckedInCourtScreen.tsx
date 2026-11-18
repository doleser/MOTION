import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {MotionButton} from '../../components/MotionButton';
import {ScreenHeader} from '../../components/ScreenHeader';
import type {MapScreenProps} from '../../navigation/types';
import {getCourt, type CourtDetails} from '../../services/courts';
import {DEMO_TOOLS_ENABLED} from '../../services/demoLocation';
import {colors, spacing, typography} from '../../theme';
import {CheckInSheets} from './CheckInSheets';
import {useCheckInFlow} from './useCheckInFlow';

/** Longest delay setTimeout accepts (about 24.8 days). */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/** Check a little after expires_at, so the server agrees it has passed. */
const EXPIRY_GRACE_MS = 2000;

/**
 * The court after a verified check-in: players here, the queue, and so on.
 * PLACEHOLDER: only check-out and expiry work for now.
 */
export function CheckedInCourtScreen({navigation, route}: MapScreenProps<'CheckedInCourt'>) {
  const {courtId} = route.params;
  const isFocused = useIsFocused();
  // Needed to verify again after the visit expires.
  const [court, setCourt] = useState<CourtDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCourt(courtId).then(
      (result) => {
        if (!cancelled) {
          setCourt(result);
        }
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [courtId]);

  const flow = useCheckInFlow({
    court: court
      ? {id: court.id, name: court.name, latitude: court.latitude, longitude: court.longitude}
      : null,
    // Verified again from CHECK-IN REQUIRED: stay here.
    onCheckedIn: () => {},
    onCourtUnavailable: () => navigation.goBack(),
    onCheckedOut: () => navigation.goBack(),
  });
  const {open, refreshMyCheckIn, myCheckIn} = flow;

  const sheet = useRef(flow.sheet);
  useEffect(() => {
    sheet.current = flow.sheet;
  }, [flow.sheet]);

  // Is the visit here still open? If not, ask to verify again. A failed
  // request (offline) changes nothing.
  const checkStillHere = useCallback(async () => {
    const mine = await refreshMyCheckIn();
    if (mine === undefined) {
      return;
    }
    const busy = sheet.current === 'verifying' || sheet.current === 'demo';
    if ((!mine || mine.courtId !== courtId) && !busy) {
      open('expired');
    }
  }, [courtId, open, refreshMyCheckIn]);

  useFocusEffect(
    useCallback(() => {
      void checkStillHere();
    }, [checkStillHere]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkStillHere();
      }
    });
    return () => subscription.remove();
  }, [checkStillHere]);

  // Show CHECK-IN REQUIRED as soon as the 3 hours are up.
  const expiresAt = myCheckIn?.courtId === courtId ? myCheckIn.expiresAt : null;
  useEffect(() => {
    if (!expiresAt) {
      return;
    }
    const delay = Math.min(
      Math.max(0, Date.parse(expiresAt) - Date.now()) + EXPIRY_GRACE_MS,
      MAX_TIMEOUT_MS,
    );
    const timer = setTimeout(() => void checkStillHere(), delay);
    return () => clearTimeout(timer);
  }, [expiresAt, checkStillHere]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {isFocused ? <StatusBar style="light" /> : null}
      <ScreenHeader title="CHECKED-IN COURT" onBack={() => navigation.goBack()} />
      <View style={styles.divider} />

      <View style={styles.content}>
        <Text style={styles.title}>{court ? court.name.toUpperCase() : ' '}</Text>
        <Text style={styles.body}>
          Checked-in court page: not implemented yet. Players here and the queue will show up
          here.
        </Text>
        <MotionButton label="CHECK OUT" variant="secondary" onPress={() => open('checkOut')} />
        {DEMO_TOOLS_ENABLED ? (
          <MotionButton
            label="PROTOTYPE CONTROLS"
            variant="secondary"
            onPress={() => open('demo')}
          />
        ) : null}
      </View>

      <CheckInSheets
        flow={flow}
        courtName={court?.name ?? ''}
        onBackToMap={() => navigation.popToTop()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.screen,
    backgroundColor: colors.line,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screen,
    gap: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.muted,
  },
});
