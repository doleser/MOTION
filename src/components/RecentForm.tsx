import {StyleSheet, Text, View} from 'react-native';

import {colors, sizes, spacing, typography} from '../theme';

/** One game's result: a win or a loss. */
export type GameResult = 'W' | 'L';

/** How many games the row shows. */
const SLOT_COUNT = 5;

/**
 * A player's last 5 games as squares, oldest on the left and newest on the
 * right: yellow W for a win, grey L for a loss. With fewer than 5 games, the
 * rest are empty outlined squares. Figma: "Recent form" on PROFILE / You.
 */
export function RecentForm({results}: {results: GameResult[]}) {
  // Keep the newest 5; pad with empty slots (null) up to 5.
  const recent = results.slice(-SLOT_COUNT);
  const slots: (GameResult | null)[] = [
    ...recent,
    ...Array<null>(SLOT_COUNT - recent.length).fill(null),
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>RECENT FORM</Text>
      <View
        style={styles.row}
        // Read as one sentence, not five separate letters.
        accessible
        accessibilityLabel={describe(recent)}>
        {slots.map((result, index) => (
          <View
            // The slots never reorder, so their position is a stable key.
            key={index}
            style={[
              styles.slot,
              result === 'W' && styles.win,
              result === 'L' && styles.loss,
              result === null && styles.unplayed,
            ]}>
            {result ? (
              <Text style={[styles.letter, result === 'W' && styles.winLetter]}>{result}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** "Last 3 games, oldest first: win, loss, win", for screen readers. */
function describe(results: GameResult[]): string {
  if (results.length === 0) {
    return 'No games played yet';
  }
  const words = results.map((result) => (result === 'W' ? 'win' : 'loss')).join(', ');
  const games = results.length === 1 ? 'game' : 'games';
  return `Last ${results.length} ${games}, oldest first: ${words}`;
}

/** Figma: 40 x 40 squares. */
const SLOT_SIZE = 40;

const styles = StyleSheet.create({
  section: {
    // Figma: 12 between the heading and the squares.
    gap: spacing.md,
  },
  heading: {
    ...typography.label,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  win: {
    backgroundColor: colors.yellow,
  },
  loss: {
    backgroundColor: colors.raised,
  },
  unplayed: {
    borderWidth: sizes.border,
    borderColor: colors.raised,
  },
  letter: {
    ...typography.label,
    color: colors.text,
  },
  winLetter: {
    // Dark letter on yellow, like the primary button.
    color: colors.bg,
  },
});
