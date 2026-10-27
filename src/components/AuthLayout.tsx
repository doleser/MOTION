import type {ReactNode} from 'react';
import {KeyboardAvoidingView, ScrollView, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, sizes, spacing} from '../theme';

interface AuthLayoutProps {
  children: ReactNode;
  /** Optional top bar (e.g. <ScreenHeader />). It stays put while content scrolls. */
  header?: ReactNode;
  /** Space between items. Figma: 16 on Log in, 12 on Sign up. */
  gap?: number;
}

/**
 * Page wrapper for the auth screens: dark background, clear of the notch and
 * home bar, 20px side margins, scrolls, and moves up when the keyboard opens.
 */
export function AuthLayout({children, header, gap = spacing.lg}: AuthLayoutProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {header}
      {/* Shrinks the page when the keyboard opens, so inputs stay visible. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            // Figma: 12 below the header, or 20 below the status bar.
            {gap, paddingTop: header ? spacing.md : spacing.screen},
          ]}
          // Lets taps reach buttons while the keyboard is open.
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    // Full width on phones; capped and centered on iPad.
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.screen,
  },
});
