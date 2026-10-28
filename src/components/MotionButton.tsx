import {ActivityIndicator, Pressable, StyleSheet, Text} from 'react-native';

import {colors, opacity, radius, sizes, spacing, typography} from '../theme';

interface MotionButtonProps {
  label: string;
  onPress: () => void;
  /** 'primary' = yellow (main action); 'secondary' = outlined. */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Shows a spinner and blocks taps, e.g. while a request is running. */
  loading?: boolean;
}

/** Full-width 48px button. Figma: "MVP / Button" (Primary, Secondary). */
export function MotionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: MotionButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;
  const labelColor = isPrimary ? colors.bg : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: isDisabled, busy: loading}}
      disabled={isDisabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.label, {color: labelColor}]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // Minimum, not fixed, so the label fits at larger text sizes.
    minHeight: sizes.control,
    padding: spacing.md,
    borderRadius: radius.none,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.yellow,
  },
  secondary: {
    backgroundColor: colors.panel,
    borderWidth: sizes.border,
    borderColor: colors.controlBorder,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  disabled: {
    opacity: opacity.disabled,
  },
  label: {
    ...typography.ui,
  },
});
