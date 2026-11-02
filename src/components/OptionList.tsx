import {Animated, Pressable, StyleSheet, View} from 'react-native';

import {colors, opacity, sizes, spacing, typography} from '../theme';
import type {ChipOption} from './ChipGroup';
import {useFade} from './useFade';

interface OptionListProps {
  options: readonly ChipOption[];
  /** The picked id, or null for none. */
  selectedId: string | null;
  /** Called with the new pick, or null when the picked row is tapped again. */
  onChange: (selectedId: string | null) => void;
}

/**
 * Single choice as a plain list: rows split by thin lines, no boxes. The
 * picked row turns yellow with a check; tap it again to clear it. Colors
 * fade rather than snap. Not in Figma: styled from the theme.
 */
export function OptionList({options, selectedId, onChange}: OptionListProps) {
  return (
    <View accessibilityRole="radiogroup">
      {options.map((option, index) => {
        const isSelected = option.id === selectedId;
        return (
          <Row
            key={option.id}
            label={option.label}
            isSelected={isSelected}
            isLast={index === options.length - 1}
            onPress={() => onChange(isSelected ? null : option.id)}
          />
        );
      })}
    </View>
  );
}

interface RowProps {
  label: string;
  isSelected: boolean;
  isLast: boolean;
  onPress: () => void;
}

function Row({label, isSelected, isLast, onPress}: RowProps) {
  const selected = useFade(isSelected);
  const color = selected.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.text, colors.yellow],
  });

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{checked: isSelected}}
      onPress={onPress}
      style={[styles.row, !isLast && styles.divider]}>
      {({pressed}) => (
        <>
          <Animated.Text style={[styles.label, {color}, pressed && styles.pressed]}>
            {label}
          </Animated.Text>
          <Animated.Text style={[styles.check, {color, opacity: selected}]}>✓</Animated.Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  divider: {
    borderBottomWidth: sizes.border,
    borderBottomColor: colors.raised,
  },
  label: {
    ...typography.ui,
    flex: 1,
  },
  check: {
    ...typography.ui,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
