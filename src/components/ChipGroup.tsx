import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, opacity, radius, sizes, spacing, typography} from '../theme';
import {useFade} from './useFade';

export interface ChipOption {
  id: string;
  label: string;
}

interface ChipGroupProps {
  /** Shown above the chips, e.g. "PLAY STYLE TAGS · PICK UP TO 3". */
  label: string;
  options: readonly ChipOption[];
  selectedIds: readonly string[];
  /** Most chips that can be picked. Once reached, the rest fade. */
  maxSelected?: number;
  /** Called with the new list of picked ids. */
  onChange: (selectedIds: string[]) => void;
}

/**
 * Multiple choice as wrapping chips. Tap to pick (yellow), tap again to
 * unpick; colors fade rather than snap. Not in Figma: styled from the theme
 * to match the buttons.
 */
export function ChipGroup({
  label,
  options,
  selectedIds,
  maxSelected = options.length,
  onChange,
}: ChipGroupProps) {
  const isFull = selectedIds.length >= maxSelected;

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          return (
            <Chip
              key={option.id}
              label={option.label}
              isSelected={isSelected}
              // At the limit, only picked chips can be tapped (to unpick them).
              isDisabled={isFull && !isSelected}
              onPress={() => toggle(option.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

interface ChipProps {
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
  onPress: () => void;
}

/** One chip. Its colors and fading glide instead of snapping. */
function Chip({label, isSelected, isDisabled, onPress}: ChipProps) {
  const selected = useFade(isSelected);
  const disabled = useFade(isDisabled);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{checked: isSelected, disabled: isDisabled}}
      disabled={isDisabled}
      onPress={onPress}>
      {({pressed}) => (
        <Animated.View
          style={[
            styles.chip,
            {
              backgroundColor: selected.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.panel, colors.yellow],
              }),
              borderColor: selected.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.controlBorder, colors.yellow],
              }),
              opacity: disabled.interpolate({
                inputRange: [0, 1],
                outputRange: [pressed ? opacity.pressed : 1, opacity.disabled],
              }),
            },
          ]}>
          <Animated.Text
            style={[
              styles.chipText,
              {
                color: selected.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.text, colors.bg],
                }),
              },
            ]}>
            {label.toUpperCase()}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: sizes.border,
    borderRadius: radius.none,
  },
  chipText: {
    ...typography.label,
  },
});
