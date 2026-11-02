import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, opacity, radius, sizes, spacing, typography} from '../theme';
import {useFade} from './useFade';

interface ChoiceCardProps {
  /** Big heading, e.g. "BEGINNER". */
  title: string;
  /** One line under the title. */
  description: string;
  /** Small line at the bottom while not picked, e.g. "TAP TO SELECT". */
  hint: string;
  /** Small line at the bottom once picked, e.g. "SELECTED". */
  selectedHint: string;
  isSelected: boolean;
  onPress: () => void;
}

/**
 * A large tappable card for picking one of a few options. Picked = yellow
 * border, yellow title, and a check; the change fades in. The whole card is
 * the tap target. Figma: "Level" card on ONBOARD / Experience.
 */
export function ChoiceCard({
  title,
  description,
  hint,
  selectedHint,
  isSelected,
  onPress,
}: ChoiceCardProps) {
  const selected = useFade(isSelected);
  const accent = selected.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.text, colors.yellow],
  });

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{checked: isSelected}}
      onPress={onPress}>
      {({pressed}) => (
        <Animated.View
          style={[
            styles.card,
            pressed && styles.pressed,
            {
              borderColor: selected.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.controlBorder, colors.yellow],
              }),
            },
          ]}>
          <View style={styles.titleRow}>
            <Animated.Text style={[styles.title, {color: accent}]}>{title}</Animated.Text>
            <Animated.Text style={[styles.check, {color: accent, opacity: selected}]}>
              ✓
            </Animated.Text>
          </View>
          <Text style={styles.description}>{description}</Text>
          <Text style={[styles.hint, isSelected && styles.hintSelected]}>
            {isSelected ? selectedHint : hint}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.panel,
    borderWidth: sizes.border,
    borderRadius: radius.none,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.section,
  },
  check: {
    ...typography.section,
  },
  description: {
    ...typography.body,
    color: colors.muted,
  },
  hint: {
    ...typography.meta,
    color: colors.muted,
  },
  hintSelected: {
    color: colors.yellow,
  },
});
