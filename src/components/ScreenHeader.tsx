import {Pressable, StyleSheet, Text, View} from 'react-native';
import {LocalSvg} from 'react-native-svg/css';

import {colors, opacity, sizes, spacing, typography} from '../theme';

// Reed's back arrow, downloaded from Figma ("Icon / back").
const backIcon = require('../../assets/icons/back.svg');

interface ScreenHeaderProps {
  title: string;
  /** Called when the back arrow is tapped. The screen decides what "back" means. */
  onBack: () => void;
}

/** Top bar with a back arrow and a title. Figma: "MVP / Header". */
export function ScreenHeader({title, onBack}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({pressed}) => [styles.back, pressed && styles.pressed]}>
        {/* The SVG file sets its own 24 x 24 size. */}
        <LocalSvg asset={backIcon} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: sizes.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.screen,
    backgroundColor: colors.bg,
  },
  back: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: opacity.pressed,
  },
  title: {
    ...typography.ui,
    color: colors.text,
    flex: 1,
  },
});
