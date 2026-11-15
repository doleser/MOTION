import {useEffect} from 'react';
import {AccessibilityInfo, Animated, StyleSheet, Text} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {colors, sizes, spacing, typography} from '../theme';
import {useFade} from './useFade';

/** How long the message stays before fading out. */
const VISIBLE_MS = 2500;

interface ToastProps {
  message: string;
  /** Fades in when true. */
  visible: boolean;
  /** Called after VISIBLE_MS; the screen sets `visible` back to false. */
  onHide: () => void;
}

/**
 * Short message at the top of the screen that fades out on its own, e.g.
 * "Challenge sent". Doesn't block taps. Not in Figma yet.
 *
 * Render it last, as a sibling of the screen's content, so it draws on top.
 */
export function Toast({message, visible, onHide}: ToastProps) {
  const insets = useSafeAreaInsets();
  const opacity = useFade(visible);

  useEffect(() => {
    if (!visible) {
      return;
    }
    // Screen readers don't notice a view that just appears, so say it aloud.
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(onHide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, message, onHide]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.toast, {top: insets.top + spacing.sm, opacity}]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    padding: spacing.md,
    backgroundColor: colors.panel,
    borderLeftWidth: sizes.progress,
    borderLeftColor: colors.yellow,
  },
  text: {
    ...typography.ui,
    color: colors.text,
  },
});
