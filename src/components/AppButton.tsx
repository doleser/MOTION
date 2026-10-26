import {ActivityIndicator, Pressable, StyleSheet, Text} from 'react-native';

import {colors, spacing} from './theme';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  /** 'primary' = filled (main action); 'secondary' = outlined. */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Shows a spinner and blocks taps, e.g. while a request is running. */
  loading?: boolean;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: AppButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

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
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <Text style={isPrimary ? styles.primaryLabel : styles.secondaryLabel}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  primaryLabel: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryLabel: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
