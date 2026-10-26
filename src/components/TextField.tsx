import {StyleSheet, Text, TextInput, type TextInputProps, View} from 'react-native';

import {colors, spacing} from './theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  /** Shown in red under the input when set. */
  error?: string | null;
}

/** A labeled text input. Any normal TextInput prop can be passed through. */
export function TextField({label, error, style, ...inputProps}: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.mutedText}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.medium,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: 14,
    color: colors.error,
  },
});
