import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, opacity, radius, sizes, spacing, typography} from '../theme';
import type {ChipOption} from './ChipGroup';
import {useFade} from './useFade';

interface SegmentedChoiceProps {
  /** Shown above the row, e.g. "POSITION". */
  label: string;
  /** A few short options; they share one row equally. */
  options: readonly ChipOption[];
  /** The picked id, or null for none. */
  selectedId: string | null;
  /** Called with the new pick, or null when the picked one is tapped again. */
  onChange: (selectedId: string | null) => void;
}

/**
 * Single choice as one row of equal buttons. Tap to pick (yellow); tap the
 * picked one again to clear it. Colors fade rather than snap. Not in Figma:
 * matches ChipGroup.
 */
export function SegmentedChoice({
  label,
  options,
  selectedId,
  onChange,
}: SegmentedChoiceProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.row}>
        {options.map((option) => {
          const isSelected = option.id === selectedId;
          return (
            <Segment
              key={option.id}
              label={option.label}
              isSelected={isSelected}
              onPress={() => onChange(isSelected ? null : option.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

interface SegmentProps {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}

/** One button in the row. Its colors glide instead of snapping. */
function Segment({label, isSelected, onPress}: SegmentProps) {
  const selected = useFade(isSelected);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{checked: isSelected}}
      onPress={onPress}
      style={styles.slot}>
      {({pressed}) => (
        <Animated.View
          style={[
            styles.segment,
            pressed && styles.pressed,
            {
              backgroundColor: selected.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.panel, colors.yellow],
              }),
              borderColor: selected.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.controlBorder, colors.yellow],
              }),
            },
          ]}>
          <Animated.Text
            style={[
              styles.text,
              {
                color: selected.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.text, colors.bg],
                }),
              },
            ]}>
            {label}
          </Animated.Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  /** Each button takes an equal share of the row. */
  slot: {
    flex: 1,
  },
  segment: {
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: sizes.border,
    borderRadius: radius.none,
  },
  text: {
    ...typography.ui,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
