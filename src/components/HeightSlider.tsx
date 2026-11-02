import Slider from '@react-native-community/slider';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, opacity, spacing, typography} from '../theme';
import {clampHeight, formatHeight, type HeightRange} from './heightMath';

interface HeightSliderProps {
  /** Shown above the slider, e.g. "HEIGHT". */
  label: string;
  /** Height in total inches, or null for "not added". */
  totalInches: number | null;
  range: HeightRange;
  /** Where the dot rests while nothing is set (e.g. 6'0"). */
  startInches: number;
  /** Called with the new height, or null when cleared. */
  onChange: (totalInches: number | null) => void;
}

/**
 * Height as a slider that snaps to whole inches, with the value shown big
 * above it and the range ends below. Until the user touches it, it shows
 * "Not added" and a gray track. A "Clear" link puts it back.
 * Close to Figma's height rail ("Height slider").
 */
export function HeightSlider({
  label,
  totalInches,
  range,
  startInches,
  onChange,
}: HeightSliderProps) {
  const isSet = totalInches !== null;

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {isSet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear height"
            hitSlop={spacing.md}
            onPress={() => onChange(null)}>
            {({pressed}) => (
              <Text style={[styles.clear, pressed && styles.pressed]}>Clear</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.value, !isSet && styles.valueEmpty]}>
        {isSet ? formatHeight(totalInches) : 'Not added'}
      </Text>

      <Slider
        accessibilityLabel="Height"
        accessibilityValue={{text: isSet ? formatHeight(totalInches) : 'Not added'}}
        minimumValue={range.min}
        maximumValue={range.max}
        step={1}
        value={totalInches ?? startInches}
        // Touching the dot counts as an answer, even without dragging.
        onSlidingStart={(value) => {
          if (!isSet) onChange(clampHeight(value, range));
        }}
        onValueChange={(value) => onChange(clampHeight(value, range))}
        // iPhone: tapping the track jumps there (Android does this already).
        tapToSeek
        // Yellow once set; gray while "not added".
        minimumTrackTintColor={isSet ? colors.yellow : colors.raised}
        maximumTrackTintColor={colors.raised}
        thumbTintColor={isSet ? colors.yellow : colors.muted}
      />

      <View style={styles.ends}>
        <Text style={styles.end}>{formatHeight(range.min)}</Text>
        <Text style={styles.end}>{formatHeight(range.max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.label,
    color: colors.muted,
  },
  clear: {
    ...typography.label,
    color: colors.yellow,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  value: {
    ...typography.section,
    color: colors.yellow,
    textAlign: 'center',
  },
  valueEmpty: {
    color: colors.muted,
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  end: {
    ...typography.meta,
    color: colors.muted,
  },
});
