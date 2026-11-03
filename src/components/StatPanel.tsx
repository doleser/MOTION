import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../theme';

export interface Stat {
  /** Already formatted, e.g. "26-14" or "65%". */
  value: string;
  /** Shown under the value, e.g. "WIN RATE". */
  label: string;
}

/**
 * A dark box with a row of numbers and their labels, sharing the width
 * equally. Figma: "Statistics" on PROFILE / You.
 */
export function StatPanel({stats}: {stats: Stat[]}) {
  return (
    <View style={styles.panel}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={styles.stat}
          // Read as one item: "65%, WIN RATE".
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}`}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.value}>
            {stat.value}
          </Text>
          <Text style={styles.label}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    // Figma: 12 apart, 16 in from the sides, 12 from the top and bottom.
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.panel,
  },
  stat: {
    flex: 1,
    gap: spacing.xs,
  },
  value: {
    ...typography.section,
    color: colors.text,
  },
  label: {
    ...typography.label,
    color: colors.muted,
  },
});
