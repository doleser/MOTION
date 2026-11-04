import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, fonts, opacity, sizes, spacing, typography} from '../theme';
import {MotionButton} from './MotionButton';

interface CourtCardProps {
  name: string;
  playerCount: number;
  /** e.g. "Indoor · Full court". Left out when empty. */
  typeLine: string;
  /** e.g. "1V1 LIVE · 2 WAITING". */
  activityLine: string;
  /** Opens the court's page. */
  onOpen: () => void;
  /** Closes the card and stays on the map. */
  onClose: () => void;
}

/**
 * A court's public numbers, shown over the map when its pin is tapped.
 * Figma: "MVP / Court card" — the whole card or the button opens the court;
 * the × closes it without leaving the map.
 */
export function CourtCard({
  name,
  playerCount,
  typeLine,
  activityLine,
  onOpen,
  onClose,
}: CourtCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${playerCount} here now. Open court details`}
      onPress={onOpen}
      style={styles.card}>
      <View style={styles.heading}>
        <Text style={styles.name} numberOfLines={1}>
          {name.toUpperCase()}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={({pressed}) => [styles.close, pressed && styles.pressed]}>
          <Text style={styles.closeLabel}>×</Text>
        </Pressable>
      </View>

      <View style={styles.activity}>
        <Text style={styles.count}>{playerCount}</Text>
        <View style={styles.activityText}>
          <Text style={styles.meta}>HERE NOW</Text>
          {typeLine ? <Text style={styles.meta}>{typeLine}</Text> : null}
        </View>
      </View>

      <Text style={styles.activityLine}>{activityLine}</Text>
      <Text style={styles.privacy}>Player details unlock after verified check-in.</Text>

      <MotionButton label="VIEW COURT DETAILS" onPress={onOpen} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderWidth: sizes.border,
    borderColor: colors.line,
  },
  heading: {
    height: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.section,
    color: colors.text,
    flex: 1,
  },
  close: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    // Figma: Inter Medium 24/28, typed directly.
    fontFamily: fonts.interMedium,
    fontSize: 24,
    lineHeight: 28,
    color: colors.text,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  activity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  count: {
    ...typography.number,
    color: colors.yellow,
    // Figma: the count column is 64 wide.
    width: 64,
  },
  activityText: {
    flex: 1,
  },
  meta: {
    ...typography.meta,
    color: colors.muted,
  },
  activityLine: {
    ...typography.label,
    color: colors.yellow,
  },
  privacy: {
    ...typography.body,
    color: colors.muted,
  },
});
