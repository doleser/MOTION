import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ErrorMessage} from '../../components/ErrorMessage';
import {MotionButton} from '../../components/MotionButton';
import {MotionField} from '../../components/MotionField';
import {PlayerRow} from '../../components/PlayerRow';
import {ScreenHeader} from '../../components/ScreenHeader';
import type {PlayerSearchResult} from '../../services/players';
import {colors, opacity, sizes, spacing, typography} from '../../theme';

import InboxIcon from '../../../assets/icons/inbox.svg';

/** What's under the search field. */
export type SearchStatus =
  /** Nothing typed: nothing below the field. */
  | {kind: 'idle'}
  | {kind: 'loading'}
  | {kind: 'results'; players: PlayerSearchResult[]}
  /** `text` is what the user typed (trimmed), for the message. */
  | {kind: 'no_results'; text: string}
  | {kind: 'error'; message: string};

interface SearchScreenViewProps {
  query: string;
  onChangeQuery: (text: string) => void;
  onSubmitQuery: () => void;
  status: SearchStatus;
  onRetry: () => void;
  onSelectPlayer: (userId: string) => void;
  /** Pending received challenges; the badge is hidden at 0. */
  pendingCount: number;
  onOpenInbox: () => void;
}

/**
 * Search tab: find players by username.
 * Figma: "SEARCH / Players" (node 2514:2401). The inbox icon and the
 * loading, no-results, and error states aren't in Figma yet.
 */
export function SearchScreenView({
  query,
  onChangeQuery,
  onSubmitQuery,
  status,
  onRetry,
  onSelectPlayer,
  pendingCount,
  onOpenInbox,
}: SearchScreenViewProps) {
  return (
    // Bottom edge left out: the tab bar already sits above the home bar.
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* A tab, so there's nothing to go back to: no back arrow. */}
      <ScreenHeader
        title="PLAYER SEARCH"
        // Figma: the title starts at the left edge, with no gap for an arrow.
        reserveBackSpace={false}
        right={<InboxButton count={pendingCount} onPress={onOpenInbox} />}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        // Taps on a result work while the keyboard is open (the screen
        // closes the keyboard itself).
        keyboardShouldPersistTaps="handled"
        // Scrolling the results closes the keyboard.
        keyboardDismissMode="on-drag"
        // iOS: lets the last results scroll up above the keyboard.
        automaticallyAdjustKeyboardInsets>
        <Text accessibilityRole="header" style={styles.title}>
          FIND PLAYERS
        </Text>
        <Text style={styles.body}>Find a friend. Check their record. Set up a 1v1.</Text>
        <Text style={styles.meta}>Search profiles—not live locations.</Text>

        <MotionField
          label="USERNAME"
          placeholder="Search by username"
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSubmitQuery}
          helper={getHelper(status)}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <Results status={status} onRetry={onRetry} onSelectPlayer={onSelectPlayer} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** The grey line under the field. Undefined keeps the line empty. */
function getHelper(status: SearchStatus): string | undefined {
  switch (status.kind) {
    case 'no_results':
      return `No players found for "${status.text}".`;
    default:
      return undefined;
  }
}

interface ResultsProps {
  status: SearchStatus;
  onRetry: () => void;
  onSelectPlayer: (userId: string) => void;
}

/** What goes below the field: a spinner, the results, or an error. */
function Results({status, onRetry, onSelectPlayer}: ResultsProps) {
  switch (status.kind) {
    case 'loading':
      return (
        <ActivityIndicator
          accessibilityLabel="Searching"
          color={colors.yellow}
          style={styles.spinner}
        />
      );
    case 'error':
      return (
        <View style={styles.error}>
          <ErrorMessage message={status.message} />
          <MotionButton label="Try again" variant="secondary" onPress={onRetry} />
        </View>
      );
    case 'results':
      return (
        <>
          <Text style={styles.sectionLabel}>PLAYERS</Text>
          {status.players.map((player) => (
            <PlayerRow
              key={player.userId}
              realName={player.realName}
              username={player.username}
              elo={player.elo}
              onPress={() => onSelectPlayer(player.userId)}
            />
          ))}
        </>
      );
    default:
      // idle, no_results: the helper line says it all.
      return null;
  }
}

interface InboxButtonProps {
  count: number;
  onPress: () => void;
}

/** Challenges inbox icon with a yellow badge for pending received challenges. */
function InboxButton({count, onPress}: InboxButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Challenges inbox, ${count} pending` : 'Challenges inbox'}
      onPress={onPress}
      style={({pressed}) => [styles.inbox, pressed && styles.pressed]}>
      {/* The SVG file sets its own 24 x 24 size. */}
      <InboxIcon />
      {count > 0 ? (
        <View style={styles.badge}>
          {/* "9+" keeps the badge a small circle. */}
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const BADGE_SIZE = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  // Figma: 12 below the header, 20 side margins, 16 between everything.
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
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
  meta: {
    ...typography.meta,
    color: colors.muted,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.muted,
  },
  spinner: {
    marginTop: spacing.sm,
  },
  error: {
    gap: spacing.md,
  },
  inbox: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: opacity.pressed,
  },
  // Not in Figma yet: a small yellow circle on the icon's top-right corner.
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    paddingHorizontal: spacing.xs,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.yellow,
  },
  badgeText: {
    ...typography.meta,
    lineHeight: BADGE_SIZE,
    color: colors.bg,
  },
});
