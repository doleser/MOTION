import {ActivityIndicator, ScrollView, StyleSheet, Text} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {ErrorMessage} from '../../components/ErrorMessage';
import {MotionButton} from '../../components/MotionButton';
import {PlayerRow} from '../../components/PlayerRow';
import type {ChallengeDisplayStatus} from '../../services/challengeStatus';
import type {Challenge} from '../../services/challenges';
import type {EloStakes} from '../../services/results';
import {colors, sizes, spacing, typography} from '../../theme';
import {formatMatchTime} from './matchTime';

/** Which button is busy, so only that one shows a spinner. */
export type BusyAction = 'accept' | 'decline' | 'cancel' | null;

/** What the pop-up is showing. */
export type DetailsState =
  | {kind: 'loading'}
  | {kind: 'error'; message: string}
  | {
      kind: 'loaded';
      challenge: Challenge;
      status: ChallengeDisplayStatus;
      /** Confirmed only: whether Check In is shown, or when it opens. */
      checkInOpen: boolean;
      checkInOpensAt: string;
      /** Ranked only. Null while loading or if it failed. */
      stakes: EloStakes | null;
    };

interface ChallengeDetailsScreenViewProps {
  state: DetailsState;
  onRetryLoad: () => void;
  busyAction: BusyAction;
  actionError: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onCheckIn: () => void;
}

/** The words that change between versions (see the table agreed in planning). */
interface VersionText {
  label: string;
  /** Yellow label for live challenges, grey for finished ones. */
  labelHighlighted: boolean;
  title: string;
  note: string | null;
}

/**
 * One challenge, as a sheet over the inbox.
 * Figma: "DIRECT / Invitation received" (node 2442:2018). The outgoing,
 * confirmed, and finished versions use the same layout with their own
 * words and buttons. Changed from the frame: date, time, and length in
 * place of "Now", and no score target.
 */
export function ChallengeDetailsScreenView(props: ChallengeDetailsScreenViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.sheet}
      // Below the home bar on iPhones without a home button.
      contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + spacing.screen}]}>
      <Body {...props} />
    </ScrollView>
  );
}

function Body(props: ChallengeDetailsScreenViewProps) {
  const {state} = props;

  if (state.kind === 'loading') {
    return <ActivityIndicator accessibilityLabel="Loading challenge" color={colors.yellow} style={styles.spinner} />;
  }

  if (state.kind === 'error') {
    return (
      <>
        <ErrorMessage message={state.message} />
        <MotionButton label="Try again" variant="secondary" onPress={props.onRetryLoad} />
      </>
    );
  }

  const {challenge, status, stakes} = state;
  const text = getVersionText(challenge, status);

  return (
    <>
      <Text style={[styles.label, text.labelHighlighted && styles.labelHighlighted]}>{text.label}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {text.title}
      </Text>

      <PlayerRow
        realName={challenge.opponent.realName}
        username={challenge.opponent.username}
        elo={challenge.opponent.elo}
      />

      <Text style={styles.court}>{challenge.court.name}</Text>
      <Text style={styles.when}>
        {formatMatchTime(challenge.startsAt)} · {challenge.durationMinutes} MIN
      </Text>

      <Text style={styles.body}>
        {challenge.ranked ? 'Ranked 1v1' : 'Casual 1v1'}
        {'\n'}
        {challenge.ranked ? formatStakes(stakes) : 'No Elo changes.'}
      </Text>

      {text.note ? <Text style={styles.body}>{text.note}</Text> : null}

      <ErrorMessage message={props.actionError} />
      <Buttons {...props} state={state} />
    </>
  );
}

/** The buttons for each version. Finished challenges have none. */
function Buttons({
  state,
  busyAction,
  onAccept,
  onDecline,
  onCancel,
  onCheckIn,
}: ChallengeDetailsScreenViewProps & {state: Extract<DetailsState, {kind: 'loaded'}>}) {
  const {challenge, status} = state;
  // While anything is sending, every button is blocked, so nothing can be
  // tapped twice or two actions can't overlap.
  const isBusy = busyAction !== null;

  if (status === 'pending' && challenge.direction === 'incoming') {
    return (
      <>
        <MotionButton
          label="ACCEPT INVITATION"
          onPress={onAccept}
          loading={busyAction === 'accept'}
          disabled={isBusy}
        />
        <MotionButton
          label="DECLINE"
          variant="secondary"
          onPress={onDecline}
          loading={busyAction === 'decline'}
          disabled={isBusy}
        />
      </>
    );
  }

  if (status === 'pending') {
    return (
      <MotionButton
        label="CANCEL CHALLENGE"
        variant="secondary"
        onPress={onCancel}
        loading={busyAction === 'cancel'}
        disabled={isBusy}
      />
    );
  }

  if (status === 'confirmed') {
    return (
      <>
        {state.checkInOpen ? (
          <MotionButton label="CHECK IN" onPress={onCheckIn} disabled={isBusy} />
        ) : (
          <Text style={styles.body}>Check-in opens at {state.checkInOpensAt}.</Text>
        )}
        <MotionButton
          label="CANCEL MATCH"
          variant="secondary"
          onPress={onCancel}
          loading={busyAction === 'cancel'}
          disabled={isBusy}
        />
      </>
    );
  }

  return null;
}

/** The label, title, and note for each version. */
function getVersionText(challenge: Challenge, status: ChallengeDisplayStatus): VersionText {
  const side = challenge.direction === 'incoming' ? 'INCOMING 1V1' : 'OUTGOING 1V1';
  switch (status) {
    case 'pending':
      return challenge.direction === 'incoming'
        ? {
            label: 'INCOMING 1V1',
            labelHighlighted: true,
            title: 'YOU’VE BEEN CHALLENGED.',
            note: 'Accept the plan now. You can meet at the court afterward.',
          }
        : {
            label: `${side} · PENDING`,
            labelHighlighted: true,
            title: 'CHALLENGE SENT.',
            note: "Waiting for them to answer. It expires at the match time if they don't.",
          };
    case 'confirmed':
      return {
        label: `${side} · CONFIRMED`,
        labelHighlighted: true,
        title: 'SEE YOU ON COURT.',
        note: 'Both players check in at the court before play.',
      };
    case 'declined':
      return {label: `${side} · DECLINED`, labelHighlighted: false, title: 'CHALLENGE DECLINED.', note: null};
    case 'cancelled':
      return {label: `${side} · CANCELLED`, labelHighlighted: false, title: 'CHALLENGE CANCELLED.', note: null};
    case 'expired':
      return {label: `${side} · EXPIRED`, labelHighlighted: false, title: 'CHALLENGE EXPIRED.', note: null};
    case 'ended':
      return {label: `${side} · ENDED`, labelHighlighted: false, title: 'MATCH ENDED.', note: null};
  }
}

/** "WIN +16 / LOSE -14", worked out on the server. */
function formatStakes(stakes: EloStakes | null): string {
  return stakes ? `WIN +${stakes.win} / LOSE ${stakes.lose}` : 'Elo stakes unavailable.';
}

const styles = StyleSheet.create({
  // Same as the challenge sheet: panel color, 20 padding, 16 between items.
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
  spinner: {
    marginVertical: spacing.xl,
  },
  label: {
    ...typography.label,
    color: colors.muted,
  },
  labelHighlighted: {
    color: colors.yellow,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  // Figma: the court in Anton 24.
  court: {
    ...typography.section,
    color: colors.text,
  },
  // Figma: the time in yellow, label style.
  when: {
    ...typography.label,
    color: colors.yellow,
  },
  body: {
    ...typography.body,
    color: colors.muted,
  },
});
