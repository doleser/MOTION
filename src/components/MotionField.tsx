import {useState} from 'react';
import {StyleSheet, Text, TextInput, type TextInputProps, View} from 'react-native';

import {colors, radius, sizes, spacing, typography} from '../theme';

interface MotionFieldProps extends TextInputProps {
  /** Shown above the input, e.g. "EMAIL". */
  label: string;
  /** Small line under the input. Its space is kept even when empty. */
  helper?: string;
}

/**
 * Label + 48px input + helper line. Figma: "MVP / Field".
 * Any normal TextInput prop (secureTextEntry, keyboardType...) passes through.
 */
export function MotionField({
  label,
  helper,
  onFocus,
  onBlur,
  style,
  ...inputProps
}: MotionFieldProps) {
  // The border turns yellow while the user is typing in this field.
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.yellow}
        style={[styles.input, isFocused && styles.inputFocused, style]}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        {...inputProps}
      />
      {/* A space keeps the line's height so the layout doesn't jump. */}
      <Text style={styles.helper}>{helper ?? ' '}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  input: {
    // Minimum, not fixed, so typed text fits at larger text sizes.
    minHeight: sizes.control,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.panel,
    borderWidth: sizes.border,
    borderColor: colors.controlBorder,
    borderRadius: radius.none,
    color: colors.text,
    // Font and size only: a lineHeight inside a TextInput can push the text
    // off-center on iOS.
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  },
  inputFocused: {
    borderColor: colors.yellow,
  },
  helper: {
    ...typography.meta,
    color: colors.muted,
  },
});
