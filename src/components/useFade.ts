import {useEffect, useState} from 'react';
import {Animated, Easing} from 'react-native';

/** How long selection fades take. Short enough to still feel instant. */
export const FADE_MS = 200;

/**
 * An animated number that glides to 1 when `on` is true and to 0 when it's
 * false, instead of jumping. Use it to fade colors or opacity, e.g. with
 * `value.interpolate({inputRange: [0, 1], outputRange: [offColor, onColor]})`.
 */
export function useFade(on: boolean): Animated.Value {
  // Created once and kept for the component's whole life.
  const [value] = useState(() => new Animated.Value(on ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(value, {
      toValue: on ? 1 : 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      // Colors can't run on the native thread, so this runs in JavaScript.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [on, value]);

  return value;
}
