import type {ReactNode} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, sizes, spacing, typography} from '../theme';

/** Figma: "Dismiss overlay", black at 48%. */
const BACKDROP = 'rgba(0, 0, 0, 0.48)';

interface MotionSheetProps {
  visible: boolean;
  /** Anton headline; use "\n" for the Figma line breaks. */
  title: string;
  body?: string;
  /** Called on a backdrop tap or Android back. Leave out to block dismissal. */
  onDismiss?: () => void;
  /** Yellow title (Figma: PROTOTYPE CONTROLS). */
  accent?: boolean;
  /** 'bottom' for the check-in overlays, 'top' for the tall demo panel. */
  position?: 'bottom' | 'top';
  /** Tighter gap between items (Figma: 12 on Demo tools, 16 elsewhere). */
  compact?: boolean;
  /** Buttons and any extra lines, in order. */
  children?: ReactNode;
}

/**
 * A panel over a dimmed screen. Figma: "OVERLAY / ..." sheets (Verify
 * location, Too far, Check out, ...).
 */
export function MotionSheet({
  visible,
  title,
  body,
  onDismiss,
  accent = false,
  position = 'bottom',
  compact = false,
  children,
}: MotionSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onDismiss?.()}>
      <Pressable
        style={styles.backdrop}
        onPress={onDismiss}
        disabled={!onDismiss}
        accessibilityLabel={onDismiss ? 'Close' : undefined}
        accessibilityRole={onDismiss ? 'button' : undefined}
      />
      <SafeAreaView
        style={[styles.frame, position === 'top' ? styles.top : styles.bottom]}
        edges={['top', 'bottom']}
        pointerEvents="box-none">
        <View style={styles.sheet} accessibilityViewIsModal>
          <ScrollView
            bounces={false}
            contentContainerStyle={[styles.content, compact && styles.compact]}>
            <Text style={[styles.title, accent && styles.accent]} accessibilityRole="header">
              {title}
            </Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BACKDROP,
  },
  frame: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.screen,
  },
  bottom: {
    justifyContent: 'flex-end',
  },
  top: {
    justifyContent: 'flex-start',
  },
  sheet: {
    maxHeight: '100%',
    backgroundColor: colors.panel,
    borderWidth: sizes.border,
    borderColor: colors.line,
  },
  content: {
    padding: spacing.screen,
    gap: spacing.lg,
  },
  compact: {
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  accent: {
    color: colors.yellow,
  },
  body: {
    ...typography.body,
    color: colors.muted,
  },
});
