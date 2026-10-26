import type {ReactNode} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {colors, spacing} from './theme';

interface ScreenProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

/** Page wrapper: a title, an optional subtitle, then the screen's content. */
export function Screen({title, subtitle, children}: ScreenProps) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      // Lets taps reach buttons while the keyboard is open.
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.large,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.small,
    fontSize: 16,
    color: colors.mutedText,
  },
  body: {
    marginTop: spacing.large,
    gap: spacing.medium,
  },
});
