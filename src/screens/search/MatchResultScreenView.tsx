import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ErrorMessage} from '../../components/ErrorMessage';
import {MotionButton} from '../../components/MotionButton';
import {PlayerRow} from '../../components/PlayerRow';
import {ScreenHeader} from '../../components/ScreenHeader';
import type {EloChange, EloStakes} from '../../services/results';
import {colors, opacity, sizes, spacing, typography} from '../../theme';
import {formatEloDelta} from './matchResult';

/** One of the two players, as these screens show them. */
export interface ResultPlayer {
  userId: string;
  realName: string;
  username: string;
  elo: number;
}

/** The Elo stakes line: loading, loaded, or failed. */
export type StakesState = {kind: 'loading'} | {kind: 'loaded'; stakes: EloStakes} | {kind: 'failed'};

/** What the screen is showing. */
export type MatchResultState =
  | {kind: 'loading'}
  | {kind: 'error'; message: string}
  | {
      kind: 'report';
      me: ResultPlayer;
      opponent: ResultPlayer;
      stakes: StakesState;
      /** The picked winner's userId, or null. */
      winnerId: string | null;
      submitting: boolean;
      submitError: string | null;
    }
  | {
      kind: 'waiting';
      me: ResultPlayer;
      opponent: ResultPlayer;
      winnerId: string;
      /** "Auto-confirms in 23h", or null until the report time has loaded. */
      autoConfirmText: string | null;
    }
  | {
      kind: 'confirm';
      me: ResultPlayer;
      opponent: ResultPlayer;
      /** The reported winner's userId (the opponent reported it). */
      winnerId: string;
      /** My stakes, so the Elo line can say what confirming does to me. */
      stakes: StakesState;
      /** Which button is running, or null. */
      busy: 'confirm' | 'dispute' | null;
      actionError: string | null;
      /** Shown above, e.g. when the user's own report lost the race. */
      notice: string | null;
    }
  | {
      kind: 'result';
      me: ResultPlayer;
      opponent: ResultPlayer;
      winnerId: string;
      /** True if I confirmed it, false if my opponent did. */
      iConfirmed: boolean;
      /** My rating change from elo_history; 'loading' or 'failed' until known. */
      change: EloChange | 'loading' | 'failed';
    }
  | {
      kind: 'disputed';
      opponent: ResultPlayer;
      /** True if I disputed it, false if my opponent did. */
      iDisputed: boolean;
    };

interface MatchResultScreenViewProps {
  state: MatchResultState;
  onBack: () => void;
  onRetry: () => void;
  onPickWinner: (userId: string) => void;
  onSubmit: () => void;
  onConfirm: () => void;
  /** Asks first (the screen shows the question), then disputes. */
  onDispute: () => void;
  /** VIEW MY PROFILE: the Profile tab. */
  onViewProfile: () => void;
}

/**
 * A ranked 1v1's result. Figma: "DIRECT / Results" (2442:2125) and
 * "DIRECT / Results waiting" (2442:2245). Confirm / Dispute has no frame of
 * its own (2442:2185 is the picker on the other phone), so it reuses the
 * picker's layout with the reported winner and two buttons. The result and
 * Result disputed views follow "DIRECT / Complete" (2442:2291), which shows a
 * casual game; here it's always ranked. BACK TO COURT is left out (the
 * header's back arrow already leaves), so VIEW MY PROFILE is the main button.
 *
 * The frames assume both players submit and matching reports count. The app
 * instead has one player report and the other confirm or dispute, so the
 * wording follows that. Left out: the match id ("DIRECT-001"), the rank tier
 * under the Elo (see PlayerRow), the waiting frame's DEMO buttons and VIEW MY
 * RESULT, and the fake status bar. Added: the Elo stakes (Use Case 4).
 */
export function MatchResultScreenView({state, onBack, ...actions}: MatchResultScreenViewProps) {
  return (
    // Bottom edge left out: the tab bar already sits above the home bar.
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="DIRECT 1V1 / RESULTS" onBack={onBack} />
      <Body state={state} {...actions} />
    </SafeAreaView>
  );
}

type BodyProps = Omit<MatchResultScreenViewProps, 'onBack'>;

function Body({state, onRetry, onPickWinner, onSubmit, onConfirm, onDispute, onViewProfile}: BodyProps) {
  switch (state.kind) {
    case 'loading':
      return (
        <View style={styles.centered}>
          <ActivityIndicator accessibilityLabel="Loading result" color={colors.yellow} />
        </View>
      );
    case 'error':
      return (
        <View style={styles.errorBox}>
          <ErrorMessage message={state.message} />
          <MotionButton label="Try again" variant="secondary" onPress={onRetry} />
        </View>
      );
    case 'report':
      return <Report state={state} onPickWinner={onPickWinner} onSubmit={onSubmit} />;
    case 'waiting':
      return <Waiting state={state} />;
    case 'confirm':
      return <Confirm state={state} onConfirm={onConfirm} onDispute={onDispute} />;
    case 'result':
      return <Outcome {...resultText(state)} onViewProfile={onViewProfile} />;
    case 'disputed':
      return <Outcome {...disputedText(state)} onViewProfile={onViewProfile} />;
  }
}

// ---------- Who won? ----------

interface ReportProps {
  state: Extract<MatchResultState, {kind: 'report'}>;
  onPickWinner: (userId: string) => void;
  onSubmit: () => void;
}

function Report({state, onPickWinner, onSubmit}: ReportProps) {
  const {me, opponent, stakes, winnerId, submitting, submitError} = state;
  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>YOUR RESULT</Text>
        <Text accessibilityRole="header" style={styles.title}>
          WHO WON?
        </Text>

        <PlayerRow realName={me.realName} username={me.username} elo={me.elo} />
        <PlayerRow realName={opponent.realName} username={opponent.username} elo={opponent.elo} />

        <Text style={styles.body}>
          Choose the winner. {firstName(opponent.realName)} then confirms or disputes it.
        </Text>

        <View accessibilityRole="radiogroup" style={styles.choices}>
          {[me, opponent].map((player) => (
            <WinnerChoice
              key={player.userId}
              label={player.realName}
              selected={winnerId === player.userId}
              disabled={submitting}
              onPress={() => onPickWinner(player.userId)}
            />
          ))}
        </View>

        <StakesLine stakes={stakes} />
        {winnerId === null ? <Text style={styles.hint}>Choose the winner.</Text> : null}
        {submitError ? <ErrorMessage message={submitError} /> : null}
      </ScrollView>

      {/* Pinned above the tab bar (Figma); the content scrolls behind it. */}
      <View style={styles.footer}>
        <MotionButton
          label="SUBMIT MY RESULT"
          onPress={onSubmit}
          disabled={winnerId === null}
          loading={submitting}
        />
      </View>
    </>
  );
}

interface WinnerChoiceProps {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** One of the two winner buttons. The picked one turns yellow. */
function WinnerChoice({label, selected, disabled, onPress}: WinnerChoiceProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label} won`}
      accessibilityState={{checked: selected, disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
    </Pressable>
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

// ---------- Waiting for the opponent ----------

function Waiting({state}: {state: Extract<MatchResultState, {kind: 'waiting'}>}) {
  const {me, opponent, winnerId, autoConfirmText} = state;
  const opponentFirst = firstName(opponent.realName);
  const winnerName = winnerId === me.userId ? me.realName : opponent.realName;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>RESULT NOT FINAL</Text>
      <Text accessibilityRole="header" style={styles.title}>
        WAITING FOR {opponentFirst.toUpperCase()}.
      </Text>

      <View style={styles.statusPanel}>
        <StatusEntry name={me.realName} status={`REPORTED: ${winnerName.toUpperCase()} WON`} />
        <StatusEntry name={opponent.realName} status="NOT CONFIRMED YET" />
      </View>

      <Text style={styles.body}>
        {opponentFirst} confirms or disputes your result. Elo changes only once it&apos;s confirmed.
      </Text>
      {autoConfirmText ? <Text style={styles.meta}>{autoConfirmText}.</Text> : null}
    </ScrollView>
  );
}

// ---------- Confirm / Dispute (the other player) ----------

interface ConfirmProps {
  state: Extract<MatchResultState, {kind: 'confirm'}>;
  onConfirm: () => void;
  onDispute: () => void;
}

function Confirm({state, onConfirm, onDispute}: ConfirmProps) {
  const {me, opponent, winnerId, stakes, busy, actionError, notice} = state;
  const iWon = winnerId === me.userId;
  const winnerName = iWon ? me.realName : opponent.realName;
  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {notice ? <Text style={styles.hint}>{notice}</Text> : null}
        <Text style={styles.eyebrow}>CONFIRM RESULT</Text>
        <Text accessibilityRole="header" style={styles.title}>
          DID {firstName(winnerName).toUpperCase()} WIN?
        </Text>

        <PlayerRow realName={me.realName} username={me.username} elo={me.elo} />
        <PlayerRow realName={opponent.realName} username={opponent.username} elo={opponent.elo} />

        <View style={styles.statusPanel}>
          <StatusEntry name={`Reported by ${opponent.realName}`} status={`WINNER: ${winnerName.toUpperCase()}`} />
        </View>

        <EloIfConfirmed stakes={stakes} iWon={iWon} />
        <Text style={styles.body}>
          Confirm if this is right. Disputing is final: the game won&apos;t count.
        </Text>
        {actionError ? <ErrorMessage message={actionError} /> : null}
      </ScrollView>

      <View style={[styles.footer, styles.footerStack]}>
        <MotionButton
          label="CONFIRM RESULT"
          onPress={onConfirm}
          loading={busy === 'confirm'}
          disabled={busy !== null}
        />
        <MotionButton
          label="DISPUTE"
          variant="secondary"
          onPress={onDispute}
          loading={busy === 'dispute'}
          disabled={busy !== null}
        />
      </View>
    </>
  );
}

/** "Confirming: +16 Elo for you" (or the loss), from the stakes. */
function EloIfConfirmed({stakes, iWon}: {stakes: StakesState; iWon: boolean}) {
  switch (stakes.kind) {
    case 'loading':
      return <Text style={styles.body}>Loading Elo stakes…</Text>;
    case 'failed':
      return <Text style={styles.body}>Couldn&apos;t load the Elo stakes.</Text>;
    case 'loaded': {
      const change = iWon ? stakes.stakes.win : stakes.stakes.lose;
      const text = change >= 0 ? `+${change}` : `${change}`;
      return <Text style={styles.stakes}>CONFIRMING: {text} ELO FOR YOU</Text>;
    }
  }
}

// ---------- The outcome: result and Result disputed ----------

interface OutcomeText {
  title: string;
  /** Yellow, big: "YOU WON", "NO RESULT". */
  outcome: string;
  /** Who confirmed or disputed it. */
  explanation: string;
  /** Yellow, big: "+16 ELO"; null while it loads. */
  impact: string | null;
  /** "1398 → 1414", or why nothing changed. */
  detail: string;
}

function resultText(state: Extract<MatchResultState, {kind: 'result'}>): OutcomeText {
  const {me, opponent, winnerId, iConfirmed, change} = state;
  const iWon = winnerId === me.userId;
  const opponentFirst = firstName(opponent.realName);
  const base = {
    title: 'GAME COMPLETE',
    outcome: iWon ? 'YOU WON' : `${opponentFirst.toUpperCase()} WON`,
    explanation: iConfirmed ? 'You confirmed the result.' : `${opponentFirst} confirmed the result.`,
  };
  if (change === 'loading') {
    return {...base, impact: null, detail: 'Loading your Elo change…'};
  }
  if (change === 'failed') {
    return {...base, impact: null, detail: "Couldn't load your Elo change. Your profile has your new rating."};
  }
  return {
    ...base,
    impact: `${formatEloDelta(change)} ELO`,
    detail: `${change.eloBefore} → ${change.eloAfter}. Ranked record updated.`,
  };
}

function disputedText(state: Extract<MatchResultState, {kind: 'disputed'}>): OutcomeText {
  const opponentFirst = firstName(state.opponent.realName);
  return {
    title: 'RESULT DISPUTED',
    outcome: 'NO RESULT',
    explanation: state.iDisputed ? 'You disputed the result.' : `${opponentFirst} disputed the result.`,
    impact: '0 ELO CHANGE',
    detail: "The game doesn't count. Neither rating nor ranked record changed.",
  };
}

interface OutcomeProps extends OutcomeText {
  onViewProfile: () => void;
}

/** The match is settled: who won (or no result), and what it did to my Elo. */
function Outcome({title, outcome, explanation, impact, detail, onViewProfile}: OutcomeProps) {
  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>DIRECT MATCH CLOSED</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.outcome}>{outcome}</Text>
        <Text style={styles.body}>{explanation}</Text>
        {impact ? <Text style={styles.outcome}>{impact}</Text> : null}
        <Text style={styles.body}>{detail}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <MotionButton label="VIEW MY PROFILE" onPress={onViewProfile} />
      </View>
    </>
  );
}

/** A name and its status, e.g. "Dev Shah / NOT CONFIRMED YET". */
function StatusEntry({name, status}: {name: string; status: string}) {
  return (
    // Read as one item, e.g. "Dev Shah, not confirmed yet".
    <View style={styles.statusEntry} accessible accessibilityLabel={`${name}, ${status}`}>
      <Text style={styles.statusName}>{name}</Text>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

/** "Dev Shah" → "Dev". */
function firstName(realName: string): string {
  return realName.trim().split(/\s+/)[0] ?? realName;
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
  // Figma: 16 below the header, 20 side margins, 16 between items.
  content: {
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingTop: spacing.lg,
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
  meta: {
    ...typography.meta,
    color: colors.muted,
  },
  // Figma: the winner and the Elo change, big and yellow.
  outcome: {
    ...typography.number,
    color: colors.yellow,
  },
  hint: {
    ...typography.label,
    color: colors.yellow,
  },
  stakes: {
    ...typography.ui,
    color: colors.yellow,
  },
  // Figma: the two buttons 16 apart.
  choices: {
    gap: spacing.lg,
  },
  // Same box as a secondary button (Figma); the picked one turns yellow.
  choice: {
    minHeight: sizes.control,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: sizes.border,
    borderColor: colors.controlBorder,
  },
  choiceSelected: {
    borderColor: colors.yellow,
  },
  choiceLabel: {
    ...typography.ui,
    color: colors.text,
  },
  choiceLabelSelected: {
    color: colors.yellow,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  // Figma: panel color, 16 padding, 12 between the lines.
  statusPanel: {
    backgroundColor: colors.panel,
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusEntry: {
    gap: spacing.md,
  },
  statusName: {
    ...typography.ui,
    color: colors.text,
  },
  statusText: {
    ...typography.label,
    color: colors.yellow,
  },
  // Two buttons, 16 apart (like the winner buttons).
  footerStack: {
    gap: spacing.lg,
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
