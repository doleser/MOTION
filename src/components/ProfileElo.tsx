import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../theme';

interface ProfileEloProps {
  elo: number;
  /**
   * Adds "· PROVISIONAL" to the label (the signed-in player's own profile,
   * while their rating is still settling).
   */
  provisional?: boolean;
}

/**
 * "1V1 ELO" and the big yellow rating. Figma: "MVP / Profile Elo" (on
 * PROFILE / You and PROFILE / Public player).
 */
export function ProfileElo({elo, provisional = false}: ProfileEloProps) {
  return (
    <View style={styles.elo}>
      <Text style={styles.label}>{provisional ? '1V1 ELO · PROVISIONAL' : '1V1 ELO'}</Text>
      <Text
        // The number alone would be read as just "800".
        accessibilityLabel={provisional ? `Elo ${elo}, provisional` : `Elo ${elo}`}
        style={styles.value}>
        {elo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  elo: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.muted,
  },
  value: {
    ...typography.elo,
    color: colors.yellow,
  },
});
