import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {MotionButton} from '../../components/MotionButton';
import {VideoBackground} from '../../components/VideoBackground';
import {colors, sizes, spacing, typography} from '../../theme';

// Bundled with the app (no download). The poster is the clip's first frame.
const WELCOME_VIDEO = require('../../../assets/videos/welcome.mp4');
const WELCOME_POSTER = require('../../../assets/images/welcome-poster.jpg');

interface WelcomeScreenViewProps {
  onCreateAccount: () => void;
  onLogIn: () => void;
}

/**
 * Welcome screen layout. Figma: "WELCOME / MOTION" (node 2273:1786).
 *
 * Doesn't use AuthLayout: this screen never scrolls and keeps its buttons
 * at the bottom, while AuthLayout is a scrolling form page.
 */
export function WelcomeScreenView({onCreateAccount, onLogIn}: WelcomeScreenViewProps) {
  return (
    <View style={styles.screen}>
      {/* Black-and-white pickup footage behind the logo and buttons. */}
      <VideoBackground source={WELCOME_VIDEO} poster={WELCOME_POSTER} />

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
          <MotionButton label="CREATE ACCOUNT" onPress={onCreateAccount} />
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
