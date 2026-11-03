import {memo} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, fonts, sizes, spacing, typography} from '../theme';

/**
 * Figma "MVP / Court marker" states:
 *   active   - players are there (yellow tile)
 *   live     - a session (King of the Court) is running (yellow outline)
 *   selected - the court you're looking at (thick yellow outline)
 *   empty    - nobody is there (grey outline)
 */
export type CourtMarkerState = 'active' | 'live' | 'selected' | 'empty';

/** Size of the square tile. */
export const COURT_MARKER_SIZE = 48;
/** Height of the live court's name tag (Figma: 22, 8 below the tile). */
const LIVE_TAG_HEIGHT = 22;
const LIVE_TAG_GAP = 8;
/** Figma: a plain name sits 5 below the tile. */
const NAME_GAP = 5;
/**
 * Total height, the same in every state so the map anchor never moves.
 * The map points at the tile's center: y = COURT_MARKER_SIZE / 2 / COURT_MARKER_HEIGHT.
 */
export const COURT_MARKER_HEIGHT = COURT_MARKER_SIZE + LIVE_TAG_GAP + LIVE_TAG_HEIGHT;
/** Total width (Figma: the name is 115 wide). */
export const COURT_MARKER_WIDTH = 115;

interface CourtMarkerProps {
  playerCount: number;
  state: CourtMarkerState;
  /** Court name, shown under the tile. */
  label: string;
}

/** The square map pin with the player count, plus the court name under it. */
export const CourtMarker = memo(function CourtMarker({
  playerCount,
  state,
  label,
}: CourtMarkerProps) {
  const isLive = state === 'live';
  return (
    <View style={styles.container}>
      <View style={[styles.tile, tileStyles[state]]}>
        <Text style={[styles.count, {color: countColors[state]}]}>{playerCount}</Text>
      </View>
      {/* Figma: a live court's name sits on a dark tag with "/ LIVE". */}
      <View style={[styles.labelBox, isLive && styles.liveLabelBox]}>
        <Text
          style={[styles.label, isLive && styles.liveLabel]}
          numberOfLines={1}>
          {isLive ? `${label} / LIVE` : label}
        </Text>
      </View>
    </View>
  );
});

const tileStyles = StyleSheet.create({
  active: {backgroundColor: colors.yellow, borderColor: colors.yellow},
  live: {backgroundColor: colors.bg, borderColor: colors.yellow},
  selected: {backgroundColor: colors.bg, borderColor: colors.yellow, borderWidth: 3},
  empty: {backgroundColor: colors.bg, borderColor: colors.muted},
});

const countColors: Record<CourtMarkerState, string> = {
  active: colors.bg,
  live: colors.yellow,
  selected: colors.yellow,
  empty: colors.muted,
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: COURT_MARKER_WIDTH,
    height: COURT_MARKER_HEIGHT,
  },
  tile: {
    width: COURT_MARKER_SIZE,
    height: COURT_MARKER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: sizes.border,
  },
  count: {
    // Figma: MOTION / section (Anton 24/30).
    ...typography.section,
  },
  labelBox: {
    marginTop: NAME_GAP,
    maxWidth: COURT_MARKER_WIDTH,
  },
  liveLabelBox: {
    marginTop: LIVE_TAG_GAP,
    height: LIVE_TAG_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg,
  },
  label: {
    // Figma: Inter Bold 9 (typed directly, not a text style).
    fontFamily: fonts.interBold,
    fontSize: 9,
    lineHeight: 12,
    color: colors.text,
    textAlign: 'center',
  },
  liveLabel: {
    color: colors.yellow,
  },
});
