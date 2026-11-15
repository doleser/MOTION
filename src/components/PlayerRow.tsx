import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, opacity, spacing, typography} from '../theme';

interface PlayerRowProps {
  /** The player's full name, shown on top. */
  realName: string;
  username: string;
  elo: number;
  onPress: () => void;
}

/**
 * One player in a list: an initials square, full name and @username, and
 * their Elo on the right. Tappable.
 * Figma: "MVP / Player row" (as used on SEARCH / Players).
 *
 * TODO: Figma shows a rank word under the Elo ("STARTER"). Add it once the
 * backend sends one; the app must never work out ranks itself.
 */
export function PlayerRow({realName, username, elo, onPress}: PlayerRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${realName}, @${username}, Elo ${elo}`}
      accessibilityHint="Opens their profile"
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.pressed]}>
      {/* Decorative: the name next to it already says who this is. */}
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={styles.initials}>{getInitials(realName)}</Text>
      </View>

      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.name}>
          {realName}
        </Text>
        <Text numberOfLines={1} style={styles.username}>
          @{username}
        </Text>
      </View>

      <Text style={styles.elo}>{elo}</Text>
    </Pressable>
  );
}

/**
 * "Noah Kim" → "NK", "Prince" → "P". Array.from splits by character, so an
 * accented letter or emoji isn't cut in half.
 */
function getInitials(realName: string): string {
  const words = realName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Figma: 44 x 44 square. */
const AVATAR_SIZE = 44;
/** Figma: the Elo column is 88 wide, so the numbers line up from row to row. */
const ELO_WIDTH = 88;

const styles = StyleSheet.create({
  // Figma: 72 tall, 8 padding, 12 between the parts. A minimum, so the row
  // grows when the user picks a larger iPhone text size.
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.panel,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  initials: {
    ...typography.ui,
    color: colors.text,
  },
  // Takes the leftover width; long names end in "…" instead of pushing the Elo.
  identity: {
    flex: 1,
  },
  name: {
    ...typography.ui,
    color: colors.text,
  },
  username: {
    ...typography.meta,
    color: colors.muted,
  },
  elo: {
    ...typography.number,
    width: ELO_WIDTH,
    color: colors.yellow,
  },
});
