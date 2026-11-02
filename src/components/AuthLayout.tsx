import type {ReactNode} from 'react';
import {KeyboardAvoidingView, ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, sizes, spacing} from '../theme';

interface AuthLayoutProps {
  children: ReactNode;
  /** Optional top bar (e.g. <ScreenHeader />). It stays put while content scrolls. */
  header?: ReactNode;
  /** Space between items. Figma: 16 on Log in, 12 on Sign up. */
  gap?: number;
  /**
   * Optional buttons pinned to the bottom (e.g. NEXT). The content scrolls
   * above them, so nothing ends up hidden behind them.
   */
  footer?: ReactNode;
}

/**
 * Page wrapper for the auth screens: dark background, clear of the notch and
 * home bar, 20px side margins, scrolls, and moves up when the keyboard opens.
 */
export function AuthLayout({
  children,
  header,
  gap = spacing.lg,
  footer,
}: AuthLayoutProps) {
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
        {/* Inside the keyboard area, so it rises above the keyboard too. */}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
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
  footer: {
    // Same width rules as the content above.
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    // Figma: buttons sit 12 apart, 20 below the scrolling content.
    gap: spacing.md,
    paddingTop: spacing.screen,
    paddingBottom: spacing.md,
  },
});
