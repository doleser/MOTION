import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

import {colors, radius, sizes, spacing, typography} from '../theme';

interface MotionCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Square checkbox with a label; tapping anywhere on the row toggles it.
 * Not in Figma: styled from the theme to match the inputs.
 */
export function MotionCheckbox({label, checked, onChange}: MotionCheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{checked}}
      onPress={() => onChange(!checked)}
      style={styles.row}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? (
          <Svg width={sizes.icon} height={sizes.icon} viewBox="0 0 24 24">
            <Path
              d="M6 12L10 16L18 8"
              stroke={colors.bg}
              strokeWidth={sizes.iconStroke}
              fill="none"
            />
          </Svg>
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: sizes.touchTarget,
  },
  box: {
    width: sizes.icon,
    height: sizes.icon,
    backgroundColor: colors.panel,
    borderWidth: sizes.border,
    borderColor: colors.controlBorder,
    borderRadius: radius.none,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.yellow,
    borderColor: colors.yellow,
  },
  label: {
    ...typography.body,
    color: colors.text,
  },
});
