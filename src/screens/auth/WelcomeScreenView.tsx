import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {MotionButton} from '../../components/MotionButton';
import {colors, sizes, spacing, typography} from '../../theme';

interface WelcomeScreenViewProps {
  onGetStarted: () => void;
  onLogIn: () => void;
}

/**
 * Welcome screen layout. Figma: "WELCOME / MOTION" (node 2273:1786).
 *
 * Doesn't use AuthLayout: this screen never scrolls and keeps its buttons
 * at the bottom, while AuthLayout is a scrolling form page.
 */
export function WelcomeScreenView({onGetStarted, onLogIn}: WelcomeScreenViewProps) {
  return (
    <View style={styles.screen}>
      {/* Background layer. Plain black for now; a black-and-white video of
          pickup games (plus a dark overlay for readability) will go here. */}
      <View style={[StyleSheet.absoluteFill, styles.background]} />

      <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
        {/* Logo, centered in the space above the buttons. */}
        <View style={styles.identity}>
          <Text
            accessibilityRole="header"
            // Brand mark: stays the same size when the phone's text size is
            // turned up, so it never wraps or gets cut off.
            maxFontSizeMultiplier={1}
            style={styles.logo}>
            MOTION
          </Text>
          <Text style={styles.tagline}>{'FIND A RUN.\nPLAY ON YOUR TERMS.'}</Text>
        </View>

        <View style={styles.actions}>
          <MotionButton label="GET STARTED" onPress={onGetStarted} />
          <MotionButton label="LOG IN" variant="secondary" onPress={onLogIn} />
          <Text style={styles.footnote}>UW / PICKUP BASKETBALL</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  background: {
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    // Full width on phones; capped and centered on iPad (same as AuthLayout).
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.screen,
  },
  identity: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    ...typography.hero,
    color: colors.yellow,
    textAlign: 'center',
  },
  tagline: {
    ...typography.label,
    color: colors.text,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.md,
  },
  footnote: {
    ...typography.meta,
    color: colors.text,
    textAlign: 'center',
  },
});
