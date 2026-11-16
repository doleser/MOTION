import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, opacity, sizes, spacing, typography} from '../theme';

import IncomingIcon from '../../assets/icons/challenge-incoming.svg';
import OutgoingIcon from '../../assets/icons/challenge-outgoing.svg';

interface ChallengeRowProps {
  direction: 'incoming' | 'outgoing';
  realName: string;
  username: string;
  courtName: string;
  /** e.g. "SAT, NOV 22 · 6:15 PM" */
  when: string;
  /** e.g. "NEW", "CONFIRMED", "DECLINED" */
  statusLabel: string;
  /** Yellow label for things that need attention or are on; grey otherwise. */
  highlightStatus: boolean;
  ranked: boolean;
  /** Faded, for finished challenges. */
  faded: boolean;
  onPress: () => void;
}

/**
 * One challenge in the inbox: an incoming or outgoing arrow, the other
 * player, court and time, and a status label. Not in Figma: built to match
 * "MVP / Player row".
 */
export function ChallengeRow({
  direction,
  realName,
  username,
  courtName,
  when,
  statusLabel,
  highlightStatus,
  ranked,
  faded,
  onPress,
}: ChallengeRowProps) {
  const Icon = direction === 'incoming' ? IncomingIcon : OutgoingIcon;
  const type = ranked ? 'RANKED' : 'CASUAL';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${direction === 'incoming' ? 'From' : 'To'} ${realName}, @${username}, ${type.toLowerCase()}, ${courtName}, ${when}, ${statusLabel.toLowerCase()}`}
      accessibilityHint="Opens the challenge"
      onPress={onPress}
      style={({pressed}) => [styles.row, faded && styles.faded, pressed && styles.pressed]}>
      <View style={styles.icon}>
        {/* The SVG file sets its own 24 x 24 size. */}
        <Icon />
      </View>

      <View style={styles.middle}>
        <Text numberOfLines={1} style={styles.name}>
          {realName}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          @{username}
        </Text>
        {/* Court and time on their own lines, so a long court name never
            cuts off the time. */}
        <Text numberOfLines={1} style={styles.meta}>
          {courtName}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {when}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.status, highlightStatus && styles.statusHighlight]}>{statusLabel}</Text>
        <Text style={styles.meta}>{type}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Same as PlayerRow: dark panel, 8 padding, 12 between the parts.
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.panel,
  },
  faded: {
    opacity: 0.5,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  icon: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  middle: {
    flex: 1,
  },
  name: {
    ...typography.ui,
    color: colors.text,
  },
  meta: {
    ...typography.meta,
    color: colors.muted,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  status: {
    ...typography.label,
    color: colors.muted,
  },
  statusHighlight: {
    color: colors.yellow,
  },
});
