import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ErrorMessage} from '../../components/ErrorMessage';
import {MotionButton} from '../../components/MotionButton';
import {PlayerRow} from '../../components/PlayerRow';
import {ScreenHeader} from '../../components/ScreenHeader';
import {colors, sizes, spacing, typography} from '../../theme';
import type {MatchAction} from './matchResult';
import {formatClockTime, formatMatchTime} from './matchTime';

/** The accepted match, as this screen shows it. */
export interface MatchDetails {
  opponent: {realName: string; username: string; elo: number};
  courtName: string;
  startsAt: Date;
  /** 15, 30, 45, or 60. */
  durationMinutes: number;
  ranked: boolean;
}

/**
 * Where the match is in time:
 *   - 'later': more than 5 minutes before the start
 *   - 'now': from 5 minutes before the start until it ends
 *   - 'ended': after the start + length
 */
export type MatchTiming = 'later' | 'now' | 'ended';

/**
 * Whether the opponent is checked in at the match's court:
 *   - 'unknown': the app can't tell yet (it only can once the user is
 *     checked in there too)
 *   - 'not_ready' / 'ready'
 */
export type OpponentStatus = 'unknown' | 'not_ready' | 'ready';

/** The opponent's status line. */
const OPPONENT_STATUS_TEXT: Record<OpponentStatus, string> = {
  unknown: 'CHECK IN TO SEE',
  not_ready: 'NOT READY',
  ready: 'READY',
};

/** What the screen is showing. */
export type MatchCheckInState =
  | {kind: 'loading'}
  | {kind: 'error'; message: string}
  | {
      kind: 'loaded';
      match: MatchDetails;
      timing: MatchTiming;
      /** The signed-in user is checked in at the match's court. */
      youCheckedIn: boolean;
      opponent: OpponentStatus;
      /** The main button (getMatchAction in matchResult.ts). */
      action: MatchAction;
    };

interface MatchCheckInScreenViewProps {
  state: MatchCheckInState;
  onBack: () => void;
  onRetry: () => void;
  onCheckIn: () => void;
  /** START MATCH, REPORT RESULT, and VIEW RESULT: open the result screen. */
  onOpenResult: () => void;
}

/**
 * An accepted 1v1: who, where, when, and whether both players have checked
 * in at the meeting court. Figma: "DIRECT / Meet at court" (node 2514:2729).
 *
 * The frame only shows "not checked in"; the other versions were agreed in
 * planning. Left out: the rank tier under the Elo (see PlayerRow), the
 * mockup-only DEMO / OPPONENT IS READY and Cancel buttons, and the fake
 * status bar.
 */
export function MatchCheckInScreenView({
  state,
  onBack,
  onRetry,
  onCheckIn,
  onOpenResult,
}: MatchCheckInScreenViewProps) {
  return (
    // Bottom edge left out: the tab bar already sits above the home bar.
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="DIRECT 1V1 / ACCEPTED" onBack={onBack} />
      <Body state={state} onRetry={onRetry} onCheckIn={onCheckIn} onOpenResult={onOpenResult} />
    </SafeAreaView>
  );
}

interface BodyProps {
  state: MatchCheckInState;
  onRetry: () => void;
  onCheckIn: () => void;
  onOpenResult: () => void;
}

function Body({state, onRetry, onCheckIn, onOpenResult}: BodyProps) {
  if (state.kind === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Loading match" color={colors.yellow} />
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={styles.errorBox}>
        <ErrorMessage message={state.message} />
        <MotionButton label="Try again" variant="secondary" onPress={onRetry} />
      </View>
    );
  }

  const {match, timing, youCheckedIn, opponent, action} = state;
  const opponentReady = opponent === 'ready';
  const ended = timing === 'ended';
  const casualReady = action === 'casual_ready';

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>INVITATION ACCEPTED</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {ended ? 'MATCH TIME HAS PASSED.' : 'SEE YOU ON COURT.'}
        </Text>
        <Text style={styles.body}>
          {ended
            ? `This match ended ${formatEnd(match)}.`
            : 'Your matchup is saved. Both players check in at the meeting court before play.'}
        </Text>

        <PlayerRow
          realName={match.opponent.realName}
          username={match.opponent.username}
          elo={match.opponent.elo}
        />

        <View style={styles.plan}>
          <Text style={styles.planLabel}>MEETING PLAN</Text>
          <Text style={styles.court}>{match.courtName}</Text>
          <View style={styles.planWhen}>
            <Text style={styles.time}>{timing === 'now' ? 'Now' : formatMatchTime(match.startsAt)}</Text>
            <Text style={styles.planLabel}>
              {match.durationMinutes} MIN · {match.ranked ? 'RANKED' : 'CASUAL'}
            </Text>
          </View>
        </View>

        {ended ? null : (
          <>
            <View style={styles.readiness}>
              <StatusLine who="YOU" status={youCheckedIn ? 'CHECKED IN' : 'NOT CHECKED IN'} done={youCheckedIn} />
              <StatusLine
                who="OPPONENT"
                status={OPPONENT_STATUS_TEXT[opponent]}
                done={opponentReady}
                // State 2: a quiet sign that the screen is still waiting on them.
                waiting={youCheckedIn && opponent === 'not_ready'}
              />
            </View>
            {casualReady ? (
              <>
                <Text style={styles.casual}>BOTH CHECKED IN · CASUAL MATCH</Text>
                <Text style={styles.body}>Casual matches aren&apos;t recorded. Enjoy the game.</Text>
              </>
            ) : (
              <Text style={styles.privacy}>
                You&apos;ll see if your opponent is here once you check in.
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {hasButton(action) ? (
        // Pinned above the tab bar (Figma); the content scrolls behind it.
        <View style={styles.footer}>
          <MainButton
            action={action}
            opponentFirstName={firstName(match.opponent.realName)}
            startsAt={match.startsAt}
            onCheckIn={onCheckIn}
            onOpenResult={onOpenResult}
          />
        </View>
      ) : null}
    </>
  );
}

/** 'casual_ready' and 'none' have no button. */
function hasButton(action: MatchAction): boolean {
  return action !== 'casual_ready' && action !== 'none';
}

interface StatusLineProps {
  who: string;
  status: string;
  /** Checked in / ready: the status turns yellow. */
  done: boolean;
  waiting?: boolean;
}

/** "YOU · NOT CHECKED IN", with the status in yellow once it's done. */
function StatusLine({who, status, done, waiting = false}: StatusLineProps) {
  return (
    // Read as one item, e.g. "You, checked in".
    <View style={styles.statusRow} accessible accessibilityLabel={`${who}, ${status}`}>
      <Text style={styles.statusText}>
        {who} · <Text style={done && styles.statusDone}>{status}</Text>
      </Text>
      {waiting ? <ActivityIndicator size="small" color={colors.yellow} /> : null}
    </View>
  );
}

interface MainButtonProps {
  action: MatchAction;
  opponentFirstName: string;
  startsAt: Date;
  onCheckIn: () => void;
  onOpenResult: () => void;
}

/**
 * The pinned button: check in, wait for the opponent and the start, then
 * start; after the match, report or view the result. The waiting versions
 * are greyed out in the same spot, so the bottom of the screen doesn't jump.
 */
function MainButton({action, opponentFirstName, startsAt, onCheckIn, onOpenResult}: MainButtonProps) {
  switch (action) {
    case 'check_in':
      return <MotionButton label="CHECK IN AT MEETING COURT" onPress={onCheckIn} />;
    case 'waiting_for_opponent':
      return (
        <MotionButton
          label={`WAITING FOR ${opponentFirstName.toUpperCase()}`}
          variant="secondary"
          disabled
          onPress={onOpenResult}
        />
      );
    case 'waiting_for_start':
      return (
        <MotionButton
          label={`STARTS AT ${formatClockTime(startsAt).toUpperCase()}`}
          variant="secondary"
          disabled
          onPress={onOpenResult}
        />
      );
    case 'start_match':
      return <MotionButton label="START MATCH" onPress={onOpenResult} />;
    case 'report_result':
      return <MotionButton label="REPORT RESULT" onPress={onOpenResult} />;
    case 'view_result':
      return <MotionButton label="VIEW RESULT" onPress={onOpenResult} />;
    default:
      return null;
  }
}

/** "Dev Shah" → "Dev". */
function firstName(realName: string): string {
  return realName.trim().split(/\s+/)[0] ?? realName;
}

/** "at 7:15 PM" today, or "SAT, NOV 22 · 7:15 PM" on an earlier day. */
function formatEnd(match: MatchDetails): string {
  const end = new Date(match.startsAt.getTime() + match.durationMinutes * 60 * 1000);
  const today = new Date().toDateString() === end.toDateString();
  return today ? `at ${formatClockTime(end)}` : formatMatchTime(end);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    padding: spacing.screen,
    gap: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  // Figma: 12 below the header, 20 side margins, 16 between items.
  content: {
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.screen,
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
  body: {
    ...typography.body,
    color: colors.muted,
  },
  // Figma: panel color, 20 padding, 12 between the lines.
  plan: {
    backgroundColor: colors.panel,
    padding: spacing.screen,
    gap: spacing.md,
  },
  planLabel: {
    ...typography.label,
    color: colors.muted,
  },
  court: {
    ...typography.section,
    color: colors.yellow,
  },
  planWhen: {
    gap: spacing.xs,
  },
  time: {
    ...typography.body,
    color: colors.text,
  },
  // Figma: the two lines 12 apart.
  readiness: {
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.label,
    color: colors.text,
  },
  statusDone: {
    color: colors.yellow,
  },
  casual: {
    ...typography.label,
    color: colors.yellow,
  },
  privacy: {
    ...typography.meta,
    color: colors.muted,
  },
  // Figma: 16 above the button, 24 below it (above the tab bar).
  footer: {
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
