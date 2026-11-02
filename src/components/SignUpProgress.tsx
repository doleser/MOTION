import {StyleSheet, View} from 'react-native';

import {colors, sizes, spacing} from '../theme';

interface SignUpProgressProps {
  /** The current step, counting from 1. Steps up to and including it are filled. */
  step: number;
  /** How many steps there are in total. */
  total: number;
}

/** Row of thin bars showing how far through sign-up the user is. Figma: "Signup progress". */
export function SignUpProgress({step, total}: SignUpProgressProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{min: 1, max: total, now: step}}
      style={styles.row}>
      {Array.from({length: total}, (_, index) => (
        <View
          key={index}
          style={[styles.segment, index < step && styles.segmentDone]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    // Figma: content starts 20 below the bar (8 here + AuthLayout's 12).
    paddingBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    height: sizes.progress,
    backgroundColor: colors.raised,
  },
  segmentDone: {
    backgroundColor: colors.yellow,
  },
});
