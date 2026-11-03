import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../theme';

interface PlayerIdentityProps {
  /** The player's username, shown big. */
  name: string;
  /** Small line under the name, e.g. "Shooter / Playmaker · 6′ 2″". Hidden if empty. */
  details?: string;
}

/**
 * A player's initials square, name, and a small details line.
 * Figma: "Player identity" on PROFILE / You.
 */
export function PlayerIdentity({name, details}: PlayerIdentityProps) {
  return (
    <View style={styles.row}>
      {/* Decorative: the name next to it already says who this is. */}
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
        <Text style={styles.initials}>{name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.text}>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.name}>
          {name.toUpperCase()}
        </Text>
        {details ? <Text style={styles.details}>{details}</Text> : null}
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
  details: {
    ...typography.meta,
    color: colors.muted,
  },
});
