import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {colors, opacity, spacing, typography} from '../theme';
import type {MainTabParamList} from './types';

import MapActiveIcon from '../../assets/icons/tab-map-active.svg';
import MapInactiveIcon from '../../assets/icons/tab-map-inactive.svg';
import PlayIcon from '../../assets/icons/tab-play.svg';
import ProfileActiveIcon from '../../assets/icons/tab-profile-active.svg';
import ProfileInactiveIcon from '../../assets/icons/tab-profile-inactive.svg';

// Icons downloaded from Figma ("MVP / Navigation"). Each SVG sets its own 22 x 22 size.
const ICONS = {
  Map: {active: MapActiveIcon, inactive: MapInactiveIcon},
  Profile: {active: ProfileActiveIcon, inactive: ProfileInactiveIcon},
};

/**
 * Bottom tab bar: Map, Play (a yellow tile), Profile.
 * Figma: "MVP / Navigation" (Active=Map / Play / Profile).
 */
export function MotionTabBar({state, navigation}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, {paddingBottom: insets.bottom}]}>
      {state.routes.map((route, index) => {
        const name = route.name as keyof MainTabParamList;
        const isActive = state.index === index;

        function onPress() {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          // Tapping the tab you're on is handled by the tab's stack (e.g. it
          // pops Court Details back to the map).
          if (!isActive && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }

        const isPlay = name === 'Play';
        const Icon = isPlay ? PlayIcon : ICONS[name][isActive ? 'active' : 'inactive'];
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{selected: isActive}}
            accessibilityLabel={name}
            onPress={onPress}
            style={({pressed}) => [
              styles.tab,
              isPlay && styles.playTab,
              pressed && styles.pressed,
            ]}>
            {isPlay ? (
              <View style={styles.playTile}>
                <Icon />
              </View>
            ) : (
              <Icon />
            )}
            <Text
              style={[
                styles.label,
                {color: isActive ? colors.yellow : isPlay ? colors.text : colors.muted},
              ]}>
              {name}
            </Text>
            {isActive ? <View style={styles.indicator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
  },
  tab: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  // Figma: the Play tab has less padding and a smaller gap, to fit the tile.
  playTab: {
    paddingVertical: spacing.xs,
    gap: 2,
  },
  playTile: {
    width: 44,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.yellow,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  label: {
    ...typography.label,
  },
  indicator: {
    width: 24,
    height: 2,
    backgroundColor: colors.yellow,
  },
});
