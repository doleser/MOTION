import {useIsFocused} from '@react-navigation/native';
import {useVideoPlayer, VideoView, type VideoSource} from 'expo-video';
import {useEffect, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

import {colors} from '../theme';
import {useFade} from './useFade';

interface VideoBackgroundProps {
  /** The clip, e.g. `require('../../assets/videos/welcome.mp4')`. */
  source: VideoSource;
  /**
   * A still of the clip's first frame. Shown until the video starts, and
   * instead of the video when Reduce Motion is on.
   */
  poster: ImageSourcePropType;
  /** How dark the overlay on top is, from 0 (none) to 1 (solid black). */
  overlayOpacity?: number;
}

/**
 * A muted, looping, full-screen video behind a screen's content, with a dark
 * overlay so text on top stays readable. Put it first inside a screen's
 * root view; it fills the screen and ignores touches.
 */
export function VideoBackground({source, poster, overlayOpacity = 0.55}: VideoBackgroundProps) {
  const reduceMotion = useReduceMotion();

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      // Decorative: screen readers skip it.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {reduceMotion ? (
        <Image source={poster} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LoopingVideo source={source} poster={poster} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.overlay, {opacity: overlayOpacity}]} />
    </View>
  );
}

/**
 * The video itself. Its own component so no video player is created at all
 * when Reduce Motion is on.
 */
function LoopingVideo({source, poster}: Pick<VideoBackgroundProps, 'source' | 'poster'>) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    // Don't stop music or podcasts the user already has playing.
    p.audioMixingMode = 'mixWithOthers';
  });

  // Only play while this screen is showing and the app is open, so the
  // video doesn't keep running (and using battery) under other screens.
  const isFocused = useIsFocused();
  const appActive = useAppActive();
  useEffect(() => {
    if (isFocused && appActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, isFocused, appActive]);

  // The poster sits on top until the first frame is drawn, then fades out.
  // It's the same picture, so the switch is invisible.
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const posterOpacity = useFade(!hasFirstFrame);

  return (
    <>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        // Fill the screen without stretching; crop the edges if needed.
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        // Android: slides along smoothly with screen transitions.
        surfaceType="textureView"
        onFirstFrameRender={() => setHasFirstFrame(true)}
      />
      <Animated.Image
        source={poster}
        style={[StyleSheet.absoluteFill, {opacity: posterOpacity}]}
        resizeMode="cover"
      />
    </>
  );
}

/** True when the phone's Reduce Motion setting is on. Updates if it changes. */
function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}

/** True while the app is open on screen (not in the background). */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  return active;
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: colors.bg,
  },
});
