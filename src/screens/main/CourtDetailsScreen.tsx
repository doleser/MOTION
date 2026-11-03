import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ErrorMessage} from '../../components/ErrorMessage';
import {MotionButton} from '../../components/MotionButton';
import {ScreenHeader} from '../../components/ScreenHeader';
import type {MapScreenProps} from '../../navigation/types';
import {getCourt, type CourtCountUpdate, type CourtDetails} from '../../services/courts';
import {getErrorMessage} from '../../services/errors';
import {colors, fonts, spacing, typography} from '../../theme';
import {useCourtCounts} from './useCourtCounts';

/** Two digits, like the Figma stats ("03"). */
function twoDigits(n: number): string {
  return String(n).padStart(2, '0');
}

/** Figma: COURT / IMA (before check-in). */
export function CourtDetailsScreen({navigation, route}: MapScreenProps<'CourtDetails'>) {
  const {courtId} = route.params;
  const isFocused = useIsFocused();
  const [court, setCourt] = useState<CourtDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by "Try again" to load the court again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCourt(courtId).then(
      (result) => {
        if (!cancelled) {
          setCourt(result);
        }
      },
      (e: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(e));
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [courtId, attempt]);

  function retry() {
    setError(null);
    setAttempt((n) => n + 1);
  }

  // Keep "HERE NOW" live while the screen is showing.
  const updateCount = useCallback(({playerCount}: CourtCountUpdate) => {
    setCourt((current) => (current ? {...current, playerCount} : current));
  }, []);
  useCourtCounts(isFocused && court ? [courtId] : [], updateCount);

  // TODO: check-in needs the check_in database function and a checkIns
  // service (location within 150 m). Not built yet.
  function showCheckInComingSoon() {
    Alert.alert('Check-in is coming soon', 'You can browse courts for now.');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {isFocused ? <StatusBar style="light" /> : null}
      <ScreenHeader title="COURT DETAILS" onBack={() => navigation.goBack()} />
      <View style={styles.divider} />

      {court ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.photoHeader}>
            {/* Blank panel until the backend stores court photos. */}
            {court.photoUrl ? (
              <>
                <Image source={{uri: court.photoUrl}} style={StyleSheet.absoluteFill} />
                <View style={styles.photoOverlay} />
              </>
            ) : null}
            <Text style={styles.photoArea}>{court.area ?? ''}</Text>
            <View style={styles.photoBottom}>
              <Text style={styles.courtName} numberOfLines={1} adjustsFontSizeToFit>
                {court.name.toUpperCase()}
              </Text>
              <Text style={styles.photoCaption}>{court.name.toUpperCase()} / BASKETBALL</Text>
            </View>
          </View>

          <View style={styles.stats}>
            <View style={[styles.stat, styles.firstStat]}>
              <Text style={[styles.statValue, styles.hereNow]}>{twoDigits(court.playerCount)}</Text>
              <Text style={styles.statLabel}>HERE NOW</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.stat, styles.middleStat]}>
              <Text style={styles.statValue}>{twoDigits(court.onTheWay)}</Text>
              <Text style={styles.statLabel}>ON THE WAY</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.stat, styles.lastStat]}>
              {court.indoor === null ? null : (
                <Text style={styles.courtType}>{court.indoor ? 'INDOOR' : 'OUTDOOR'}</Text>
              )}
              {court.isFullCourt === null ? null : (
                <Text style={styles.courtSize}>
                  {court.isFullCourt ? 'FULL COURT' : 'HALF COURT'}
                </Text>
              )}
            </View>
          </View>

          {court.accessNote ? <Text style={styles.accessNote}>{court.accessNote}</Text> : null}

          <View style={styles.checkIn}>
            {court.status === 'closed' ? (
              <MotionButton label="NOT AVAILABLE" onPress={() => {}} disabled />
            ) : (
              <MotionButton label="CHECK IN" onPress={showCheckInComingSoon} />
            )}
          </View>

          <View style={styles.privacyCard}>
            <Text style={styles.privacyTitle}>{'PLAYERS STAY\nPRIVATE'}</Text>
            <Text style={styles.privacyBody}>
              Verify that you are at {court.name} to see player names, profiles and the 1v1
              queue.
            </Text>
            {court.sessionLive ? <Text style={styles.sessionLine}>1V1 KOTC IS RUNNING</Text> : null}
            <MotionButton
              label="VERIFY & SEE PLAYERS"
              variant="secondary"
              onPress={showCheckInComingSoon}
              disabled={court.status === 'closed'}
            />
          </View>
        </ScrollView>
      ) : error ? (
        <View style={styles.message}>
          <ErrorMessage message={error} />
          <MotionButton label="TRY AGAIN" variant="secondary" onPress={retry} />
        </View>
      ) : (
        <View style={styles.message}>
          <ActivityIndicator color={colors.yellow} />
        </View>
      )}
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
    paddingHorizontal: spacing.screen,
    // Figma: 14 below the divider.
    paddingTop: 14,
    paddingBottom: spacing.screen,
  },
  photoHeader: {
    height: 166,
    padding: spacing.lg,
    paddingBottom: 10,
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    overflow: 'hidden',
  },
  photoOverlay: {
    // Figma: "Photo / Editable contrast overlay", black at 38%.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  photoArea: {
    // Figma: Inter Bold 10/14, typed directly.
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 14,
    color: colors.text,
  },
  photoBottom: {
    gap: spacing.sm,
  },
  courtName: {
    // Figma: Anton 53/65, typed directly.
    fontFamily: fonts.anton,
    fontSize: 53,
    color: colors.text,
  },
  photoCaption: {
    // Figma: Inter Medium 9/12, typed directly.
    fontFamily: fonts.interMedium,
    fontSize: 9,
    lineHeight: 12,
    color: colors.text,
  },
  stats: {
    // Figma: 16 below the photo, 64 tall.
    marginTop: spacing.lg,
    height: 64,
    flexDirection: 'row',
  },
  stat: {
    justifyContent: 'flex-start',
  },
  // Figma column widths: 113 | 141 | 96 (separators at 113 and 254).
  firstStat: {
    flex: 113,
  },
  middleStat: {
    flex: 140,
    paddingLeft: 21,
  },
  lastStat: {
    flex: 95,
    paddingLeft: 22,
    paddingTop: 9,
  },
  statDivider: {
    width: 1,
    height: 55,
    marginTop: 3,
    backgroundColor: colors.line,
  },
  statValue: {
    // Figma: Anton 34/42, typed directly.
    fontFamily: fonts.anton,
    fontSize: 34,
    lineHeight: 42,
    color: colors.text,
  },
  hereNow: {
    color: colors.yellow,
  },
  statLabel: {
    // Figma: Inter Bold 10/14, typed directly.
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 14,
    color: colors.muted,
    marginTop: 2,
  },
  courtType: {
    ...typography.label,
    color: colors.text,
  },
  courtSize: {
    // Figma: Inter Medium 9/13, typed directly.
    fontFamily: fonts.interMedium,
    fontSize: 9,
    lineHeight: 13,
    color: colors.muted,
    marginTop: 6,
  },
  accessNote: {
    // Figma: Inter Regular 11/16, typed directly.
    fontFamily: fonts.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 14,
  },
  checkIn: {
    marginTop: 14,
  },
  privacyCard: {
    // Figma: 22 below Check in.
    marginTop: 22,
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.panel,
  },
  privacyTitle: {
    ...typography.section,
    color: colors.text,
  },
  privacyBody: {
    ...typography.body,
    color: colors.muted,
  },
  sessionLine: {
    ...typography.label,
    color: colors.yellow,
  },
  message: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.screen,
    gap: spacing.lg,
  },
});
