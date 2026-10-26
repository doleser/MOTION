import {StyleSheet, Text} from 'react-native';

import {colors} from './theme';

/** Shows a red error line, or nothing when `message` is null. */
export function ErrorMessage({message}: {message: string | null}) {
  if (!message) {
    return null;
  }
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 15,
    color: colors.error,
  },
});
