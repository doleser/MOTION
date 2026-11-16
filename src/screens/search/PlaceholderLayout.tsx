import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import type {ReactNode} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {ScreenHeader} from '../../components/ScreenHeader';
import {colors, spacing, typography} from '../../theme';

interface PlaceholderLayoutProps {
  title: string;
  /** Leave out on the first screen of the stack, which has nowhere to go back to. */
  onBack?: () => void;
  /** Passed to ScreenHeader's right slot. */
  headerRight?: ReactNode;
  /** One line saying what the real screen will show. */
  note: string;
  /** The buttons that move through the flow. */
  children?: ReactNode;
}

/**
 * TEMPORARY: the shared layout for the Search tab's placeholder screens
 * (header, a note, then buttons). Delete it once each screen gets its
 * Figma design.
 */
export function PlaceholderLayout({
  title,
  onBack,
  headerRight,
  note,
  children,
}: PlaceholderLayoutProps) {
  const isFocused = useIsFocused();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {isFocused ? <StatusBar style="light" /> : null}
      <ScreenHeader title={title} onBack={onBack} right={headerRight} />
      <View style={styles.divider} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.note}>{note}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.screen,
    backgroundColor: colors.line,
  },
  content: {
    padding: spacing.screen,
    gap: spacing.md,
  },
  note: {
    ...typography.body,
    color: colors.muted,
  },
});
