import {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {MotionButton} from '../../components/MotionButton';
import {MotionField} from '../../components/MotionField';
import {SegmentedChoice} from '../../components/SegmentedChoice';
import type {SearchScreenProps} from '../../navigation/types';
import {colors, spacing, typography} from '../../theme';

const MATCH_TYPES = [
  {id: 'ranked', label: 'Ranked'},
  {id: 'casual', label: 'Casual'},
] as const;

/**
 * PLACEHOLDER: the challenge form, shown as a sheet over the player's
 * profile (see SearchStack). Every field is required.
 *
 * TODO: swap the date and time text fields for real pickers (needs a
 * package, e.g. @react-native-community/datetimepicker) and the court field
 * for a court list.
 */
export function CreateChallengeScreen({navigation, route}: SearchScreenProps<'CreateChallenge'>) {
  const {opponentId} = route.params;
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [court, setCourt] = useState('');
  const [matchType, setMatchType] = useState<string | null>(null);

  const isComplete =
    date.trim() !== '' && time.trim() !== '' && court.trim() !== '' && matchType !== null;

  function sendChallenge() {
    // TODO: create the challenge, and only close the sheet if it worked.
    // Closing back to the profile with `challengeSentAt` tells it to show
    // "Challenge sent". A timestamp, so a second send shows it again.
    navigation.popTo(
      'PlayerProfile',
      {userId: opponentId, challengeSentAt: Date.now()},
      {merge: true},
    );
  }

  return (
    <View style={[styles.sheet, {paddingBottom: insets.bottom + spacing.screen}]}>
      <Text style={styles.title}>CHALLENGE</Text>
      <Text style={styles.note}>{`Placeholder fields. (opponentId: ${opponentId})`}</Text>

      <MotionField label="DATE" placeholder="e.g. Sat, Nov 22" value={date} onChangeText={setDate} />
      <MotionField label="TIME" placeholder="e.g. 6:00 PM" value={time} onChangeText={setTime} />
      <MotionField label="COURT" placeholder="e.g. IMA" value={court} onChangeText={setCourt} />
      <SegmentedChoice
        label="MATCH TYPE"
        options={MATCH_TYPES}
        selectedId={matchType}
        onChange={setMatchType}
      />

      <View style={styles.buttons}>
        <MotionButton label="Send challenge" disabled={!isComplete} onPress={sendChallenge} />
        <MotionButton label="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No flex: 1, so the sheet grows to fit its content ('fitToContents').
  sheet: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
  note: {
    ...typography.body,
    color: colors.muted,
  },
  buttons: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
});
