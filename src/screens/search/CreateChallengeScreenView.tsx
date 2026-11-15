import DateTimePicker from '@react-native-community/datetimepicker';
import {ActivityIndicator, Platform, ScrollView, StyleSheet, Text} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {ErrorMessage} from '../../components/ErrorMessage';
import {MotionButton} from '../../components/MotionButton';
import {OptionList} from '../../components/OptionList';
import {PlayerRow} from '../../components/PlayerRow';
import {SegmentedChoice} from '../../components/SegmentedChoice';
import {MATCH_LENGTHS, START_STEP_MINUTES} from '../../services/challengeTime';
import type {EloStakes} from '../../services/challenges';
import type {Court} from '../../services/courts';
import type {PlayerProfile} from '../../services/players';
import {colors, sizes, spacing, typography} from '../../theme';

const MATCH_TYPES = [
  {id: 'casual', label: 'Casual'},
  {id: 'ranked', label: 'Ranked'},
] as const;

const LENGTH_OPTIONS = MATCH_LENGTHS.minutes.map((minutes) => ({
  id: String(minutes),
  label: String(minutes),
}));

/** What the sheet is showing. */
export type SheetState =
  | {kind: 'loading'}
  | {kind: 'error'; message: string}
  | {kind: 'ready'; opponent: PlayerProfile; courts: Court[]};

/** The Elo stakes line: loading, loaded, or failed (ranked only). */
export type StakesState = {kind: 'loading'} | {kind: 'loaded'; stakes: EloStakes} | {kind: 'failed'};

interface CreateChallengeScreenViewProps {
  state: SheetState;
  onRetryLoad: () => void;

  courtId: number | null;
  isCourtListOpen: boolean;
  onToggleCourtList: () => void;
  onPickCourt: (courtId: number) => void;

  startsAt: Date | null;
  /** iOS only: the date-and-time wheel is open inside the sheet. */
  isTimePickerOpen: boolean;
  onPressTime: () => void;
  onPickTime: (date: Date) => void;
  /** The picker's limits (iOS wheel). */
  earliestStart: Date;
  latestStart: Date;

  ranked: boolean;
  onChangeRanked: (ranked: boolean) => void;
  durationMinutes: number;
  onChangeDuration: (minutes: number) => void;
  stakes: StakesState;

  canSend: boolean;
  isSending: boolean;
  sendError: string | null;
  onSend: () => void;
  onGoBack: () => void;
}

/**
 * The challenge sheet over another player's profile.
 * Figma: "DIRECT / Challenge setup" (node 2442:1943). Added to the frame:
 * match type, length, and the ranked Elo stakes. Changed: no score target,
 * and the time starts empty (it must be in the future, so no "NOW").
 */
export function CreateChallengeScreenView(props: CreateChallengeScreenViewProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.sheet}
      // Below the home bar on iPhones without a home button.
      contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + spacing.screen}]}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>DIRECT 1V1 · INVITATION</Text>
      <Text accessibilityRole="header" style={styles.title}>
        GOT A GAME?
      </Text>
      <SheetBody {...props} />
    </ScrollView>
  );
}

function SheetBody(props: CreateChallengeScreenViewProps) {
  const {state} = props;

  if (state.kind === 'loading') {
    return (
      <ActivityIndicator accessibilityLabel="Loading" color={colors.yellow} style={styles.spinner} />
    );
  }

  if (state.kind === 'error') {
    return (
      <>
        <ErrorMessage message={state.message} />
        <MotionButton label="Try again" variant="secondary" onPress={props.onRetryLoad} />
        <MotionButton label="GO BACK" variant="secondary" onPress={props.onGoBack} />
      </>
    );
  }

  const {opponent, courts} = state;
  const court = courts.find((c) => c.id === props.courtId);

  return (
    <>
      <PlayerRow realName={opponent.realName} username={opponent.username} elo={opponent.elo} />

      <MotionButton
        label={court ? `COURT · ${court.name.toUpperCase()}` : 'CHOOSE A COURT'}
        variant="secondary"
        onPress={props.onToggleCourtList}
        disabled={props.isSending}
      />
      {props.isCourtListOpen ? (
        courts.length > 0 ? (
          // Its own scroll area, so a long list doesn't push the rest away.
          <ScrollView style={styles.courtList} nestedScrollEnabled>
            <OptionList
              // OptionList works with text ids; court ids are numbers.
              options={courts.map((c) => ({id: String(c.id), label: c.name}))}
              selectedId={props.courtId === null ? null : String(props.courtId)}
              onChange={(id) => {
                // Tapping the picked court again just closes the list.
                if (id === null) {
                  props.onToggleCourtList();
                } else {
                  props.onPickCourt(Number(id));
                }
              }}
            />
          </ScrollView>
        ) : (
          <Text style={styles.body}>No courts are available right now.</Text>
        )
      ) : null}

      <MotionButton
        label={props.startsAt ? `TIME · ${formatStart(props.startsAt)}` : 'CHOOSE A TIME'}
        variant="secondary"
        onPress={props.onPressTime}
        disabled={props.isSending}
      />
      {Platform.OS === 'ios' && props.isTimePickerOpen && props.startsAt ? (
        <DateTimePicker
          value={props.startsAt}
          mode="datetime"
          display="spinner"
          minuteInterval={START_STEP_MINUTES}
          minimumDate={props.earliestStart}
          maximumDate={props.latestStart}
          themeVariant="dark"
          textColor={colors.text}
          onValueChange={(_event, date) => props.onPickTime(date)}
        />
      ) : null}

      <SegmentedChoice
        label="MATCH TYPE"
        options={MATCH_TYPES}
        selectedId={props.ranked ? 'ranked' : 'casual'}
        // Tapping the picked one again would clear it; keep a type picked.
        onChange={(id) => id && props.onChangeRanked(id === 'ranked')}
      />
      <SegmentedChoice
        label="LENGTH (MINUTES)"
        options={LENGTH_OPTIONS}
        selectedId={String(props.durationMinutes)}
        onChange={(id) => id && props.onChangeDuration(Number(id))}
      />

      <Text style={styles.summary}>
        {props.ranked ? 'RANKED' : 'CASUAL'} 1V1 · {props.durationMinutes} MIN
      </Text>
      {props.ranked ? <StakesLine stakes={props.stakes} /> : null}
      <Text style={styles.body}>
        Invite them from anywhere. They accept the court and time; both players check in there
        before playing.{props.ranked ? '' : ' No Elo changes.'}
      </Text>

      <ErrorMessage message={props.sendError} />
      <MotionButton
        label="SEND INVITATION"
        onPress={props.onSend}
        disabled={!props.canSend}
        loading={props.isSending}
      />
      <MotionButton
        label="GO BACK"
        variant="secondary"
        onPress={props.onGoBack}
        disabled={props.isSending}
      />
    </>
  );
}

/** "WIN +16 / LOSE -14", worked out on the server. */
function StakesLine({stakes}: {stakes: StakesState}) {
  switch (stakes.kind) {
    case 'loading':
      return <Text style={styles.body}>Loading Elo stakes…</Text>;
    case 'failed':
      return <Text style={styles.body}>Couldn&apos;t load the Elo stakes.</Text>;
    case 'loaded':
      return (
        <Text
          style={styles.stakes}
          accessibilityLabel={`Win: plus ${stakes.stakes.win} Elo. Lose: minus ${Math.abs(stakes.stakes.lose)} Elo.`}>
          WIN +{stakes.stakes.win} / LOSE {stakes.stakes.lose}
        </Text>
      );
  }
}

/** "SAT, NOV 22 · 6:15 PM", in the phone's language and time zone. */
function formatStart(date: Date): string {
  const day = date.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
  const time = date.toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  return `${day} · ${time}`.toUpperCase();
}

const styles = StyleSheet.create({
  // Figma: the sheet is the panel color, with 20 padding and 16 between items.
  sheet: {
    backgroundColor: colors.panel,
  },
  content: {
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  eyebrow: {
    ...typography.label,
    color: colors.yellow,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  spinner: {
    marginVertical: spacing.xl,
  },
  courtList: {
    maxHeight: 240,
  },
  summary: {
    ...typography.label,
    color: colors.yellow,
  },
  stakes: {
    ...typography.ui,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.muted,
  },
});
