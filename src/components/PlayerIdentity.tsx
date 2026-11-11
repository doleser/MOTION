import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../theme';

interface PlayerIdentityProps {
  /** The player's real name, shown big. Older accounts may not have one. */
  realName?: string;
  /** The player's username, shown small and grey as "@username". */
  username: string;
}

/**
 * A square with the first letter of the player's real name, the real name,
 * and "@username" under it.
 * With no real name, the username is the big line (and the square's
 * letter), and the grey line is hidden.
 * Figma: "Player identity" on PROFILE / You.
 */
export function PlayerIdentity({realName, username}: PlayerIdentityProps) {
  const mainLine = realName || username;
  // Array.from splits by character, not by UTF-16 unit, so a name that
  // starts with an emoji or an accented letter isn't cut in half.
  const initial = (Array.from(mainLine)[0] ?? '').toUpperCase();

  return (
    <View style={styles.row}>
      {/* Decorative: the name next to it already says who this is. */}
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={styles.initials}>{initial}</Text>
      </View>
      <View style={styles.text}>
        {/* One line; a long name shrinks to fit instead of wrapping. */}
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.name}>
          {mainLine.toUpperCase()}
        </Text>
        {realName && username ? (
          <Text numberOfLines={1} style={styles.username}>
            @{username}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Figma: 64 x 64 square. */
const AVATAR_SIZE = 64;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Figma: 20 between the square and the name.
    gap: spacing.screen,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  initials: {
    ...typography.section,
    color: colors.text,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  username: {
    ...typography.meta,
    color: colors.muted,
  },
});
