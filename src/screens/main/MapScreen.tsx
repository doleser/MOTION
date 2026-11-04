import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {memo, useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MapView, {
  Marker,
  type MapMarker,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import {SafeAreaView} from 'react-native-safe-area-context';

import {CourtCard} from '../../components/CourtCard';
import {
  COURT_MARKER_HEIGHT,
  COURT_MARKER_WIDTH,
  CourtMarker,
  type CourtMarkerState,
} from '../../components/CourtMarker';
import type {MapScreenProps} from '../../navigation/types';
import {getCourtPreview, type CourtPin, type LatLng} from '../../services/courts';
import {DEFAULT_LOCATION, getCurrentLocation} from '../../services/location';
import {colors, fonts, opacity, sizes, spacing, typography} from '../../theme';
import {darkMapStyle} from './darkMapStyle';
import {useCourtCounts} from './useCourtCounts';
import {useNearbyCourts} from './useNearbyCourts';

// Recenter icon, downloaded from Figma ("Icon / target").
import TargetIcon from '../../../assets/icons/target.svg';

/** How far the map is zoomed when it opens or recenters (about 4 km tall). */
const START_DELTA = 0.04;

/** A map tap this close (in points) to a court's tile selects that court. */
const TAP_RADIUS = 40;
/** Ignore a second select within this long (one tap can fire two handlers). */
const OPEN_COOLDOWN_MS = 800;

function regionAround(center: LatLng): Region {
  return {...center, latitudeDelta: START_DELTA, longitudeDelta: START_DELTA};
}

/** Figma: MAP / UW home. */
export function MapScreen({navigation}: MapScreenProps<'MapHome'>) {
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView>(null);
  const [startRegion, setStartRegion] = useState<Region | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);
  /** The court whose card is open, if any. */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const {courts, isLoading, error, loadAround, onRegionChangeComplete, refresh, updateCount} =
    useNearbyCourts();

  // Live counts for the courts on screen, only while the map is showing.
  useCourtCounts(isFocused ? courts.map((court) => court.id) : [], updateCount);

  // Open on the user's position, or on UW without location access.
  useEffect(() => {
    let cancelled = false;
    getCurrentLocation().then((location) => {
      if (cancelled) {
        return;
      }
      const center = location ?? DEFAULT_LOCATION;
      setUserLocation(location);
      setStartRegion(regionAround(center));
      loadAround(center);
    });
    return () => {
      cancelled = true;
    };
  }, [loadAround]);

  // Open a court's card, at most once per tap. On iOS a tap on a pin can
  // reach both the pin's onPress and the map's onPress.
  const lastSelectedAt = useRef(0);
  const selectCourt = useCallback((court: CourtPin) => {
    const now = Date.now();
    if (now - lastSelectedAt.current < OPEN_COOLDOWN_MS) {
      return;
    }
    lastSelectedAt.current = now;
    setSelectedId(court.id);
  }, []);

  const shownCourts = activeOnly ? courts.filter((court) => court.playerCount > 0) : courts;
  // Null when nothing is selected, or the selected court left the map
  // (filtered out or out of range).
  const selectedCourt = shownCourts.find((court) => court.id === selectedId) ?? null;

  function openSelectedCourt() {
    if (!selectedCourt) {
      return;
    }
    setSelectedId(null);
    navigation.navigate('CourtDetails', {courtId: selectedCourt.id});
  }

  // Pin taps on iOS, and a backup on Android. iOS pins have no tap area of
  // their own (see PinAnchor), so select the court whose tile is closest to
  // the tap, if it's within TAP_RADIUS.
  async function handleMapPress(event: MapPressEvent) {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    try {
      const tap = await map.pointForCoordinate(event.nativeEvent.coordinate);
      const points = await Promise.all(
        shownCourts.map((court) => map.pointForCoordinate(court)),
      );
      let nearest: CourtPin | null = null;
      let nearestDistance = TAP_RADIUS;
      points.forEach((point, i) => {
        const distance = Math.hypot(point.x - tap.x, point.y - tap.y);
        if (distance <= nearestDistance) {
          nearestDistance = distance;
          nearest = shownCourts[i];
        }
      });
      if (nearest !== null) {
        selectCourt(nearest);
      } else if (Date.now() - lastSelectedAt.current >= OPEN_COOLDOWN_MS) {
        // A tap on empty map closes the card. Skip right after a select, in
        // case this is the same tap that hit a pin.
        setSelectedId(null);
      }
    } catch {
      // The map isn't ready; the pin's own onPress still works.
    }
  }

  async function recenter() {
    const location = await getCurrentLocation();
    if (location) {
      setUserLocation(location);
    }
    mapRef.current?.animateToRegion(regionAround(location ?? DEFAULT_LOCATION), 400);
  }

  const countLabel = `${shownCourts.length} ${shownCourts.length === 1 ? 'COURT' : 'COURTS'} NEARBY`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {isFocused ? <StatusBar style="light" /> : null}

      <View style={styles.header}>
        <Text style={styles.wordmark}>MOTION</Text>
        <Text style={styles.area}>UW / SEATTLE</Text>
      </View>

      <View style={styles.mapArea}>
        {startRegion ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={startRegion}
            onRegionChangeComplete={onRegionChangeComplete}
            onPress={handleMapPress}
            userInterfaceStyle="dark"
            customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
            showsPointsOfInterests={false}
            showsCompass={false}
            toolbarEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}>
            {/* Figma darkens the map behind the card ("Dismiss overlay"). We
                skip that: Apple Maps draws map shapes a beat after the card
                appears, and a layer on top would cover the selected pin.
                Instead the other pins fade. A tap on empty map closes the card. */}
            {shownCourts.map((court) => (
              <CourtMapPin
                key={court.id}
                court={court}
                selected={court.id === selectedCourt?.id}
                dimmed={selectedCourt !== null && court.id !== selectedCourt.id}
                onSelect={selectCourt}
              />
            ))}
            {userLocation ? <YouMarker location={userLocation} /> : null}
          </MapView>
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.yellow} />
          </View>
        )}

        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{selected: activeOnly}}
            accessibilityHint="Switches between all courts and courts with players"
            onPress={() => setActiveOnly((value) => !value)}
            style={({pressed}) => [styles.filter, pressed && styles.pressed]}>
            <Text style={styles.filterLabel}>{activeOnly ? 'ACTIVE ONLY' : 'ALL COURTS'}</Text>
          </Pressable>
          <Text style={styles.countLabel}>{countLabel}</Text>
          {isLoading ? <ActivityIndicator size="small" color={colors.muted} /> : null}
        </View>

        <View style={styles.bottomArea} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Center the map on me"
            onPress={recenter}
            style={({pressed}) => [styles.recenter, pressed && styles.pressed]}>
            <TargetIcon />
          </Pressable>

          {error ? (
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.card}>
              <Text style={[styles.cardTitle, styles.errorTitle]}>{"COULDN'T LOAD COURTS"}</Text>
              <Text style={styles.cardBody}>{error} Tap to try again.</Text>
            </Pressable>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>FIND YOUR NEXT RUN</Text>
              <Text style={styles.cardBody}>
                {'Tap a court pin to preview its activity.\nOpen the card for full court details.'}
              </Text>
            </View>
          )}
        </View>

        {selectedCourt ? (
          <View style={styles.courtCard} pointerEvents="box-none">
            <CourtCard
              name={selectedCourt.name}
              playerCount={selectedCourt.playerCount}
              {...getCourtPreview(selectedCourt.id, selectedCourt.playerCount)}
              onOpen={openSelectedCourt}
              onClose={() => setSelectedId(null)}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function markerStateOf(court: CourtPin, selected: boolean): CourtMarkerState {
  if (selected) {
    return 'selected';
  }
  if (court.sessionLive) {
    return 'live';
  }
  return court.playerCount > 0 ? 'active' : 'empty';
}

/** How see-through the other pins are while a court's card is open. */
const DIMMED_PIN_OPACITY = 0.72;

/** Long enough for a custom marker to finish drawing before it's frozen. */
const MARKER_REDRAW_MS = 500;

/**
 * One court on the map. Custom markers are redrawn only for a moment after
 * their count changes (`tracksViewChanges`), which keeps panning smooth.
 */
const CourtMapPin = memo(function CourtMapPin({
  court,
  selected,
  dimmed,
  onSelect,
}: {
  court: CourtPin;
  selected: boolean;
  /** Another court's card is open, so this pin fades back. */
  dimmed: boolean;
  onSelect: (court: CourtPin) => void;
}) {
  const state = markerStateOf(court, selected);
  // Redraw whenever what the pin shows differs from what was last frozen.
  const look = `${court.playerCount}/${state}/${dimmed}`;
  const pinOpacity =
    (court.status === 'closed' ? opacity.disabled : 1) * (dimmed ? DIMMED_PIN_OPACITY : 1);
  const [frozenLook, setFrozenLook] = useState<string | null>(null);
  const redraw = frozenLook !== look;
  const markerRef = useRef<MapMarker>(null);

  function handlePress() {
    onSelect(court);
    // A tapped pin can stay "selected" natively, and the next tap on it may be
    // swallowed. Deselect it right away so every tap starts fresh.
    markerRef.current?.hideCallout();
  }

  useEffect(() => {
    const timer = setTimeout(() => setFrozenLook(look), MARKER_REDRAW_MS);
    return () => clearTimeout(timer);
  }, [look]);

  return (
    <Marker
      ref={markerRef}
      coordinate={{latitude: court.latitude, longitude: court.longitude}}
      // The tile is the marker's center. Android uses `anchor`; iOS ignores
      // it, and PinAnchor centers the tile instead.
      anchor={{x: 0.5, y: 0.5}}
      tracksViewChanges={redraw}
      // iOS taps go through the map's onPress (see handleMapPress).
      tappable={!IS_IOS}
      // The selected pin draws on top of its neighbors.
      zIndex={selected ? 1 : 0}
      onPress={handlePress}
      accessibilityLabel={`${court.name}, ${court.playerCount} playing`}>
      <PinAnchor
        width={COURT_MARKER_WIDTH}
        pointY={COURT_MARKER_HEIGHT / 2}
        style={{opacity: pinOpacity}}>
        <CourtMarker
          playerCount={court.playerCount}
          state={state}
          label={court.name.toUpperCase()}
        />
      </PinAnchor>
    </Marker>
  );
});

/** The user's position. Figma: "Your location / demo" + "YOU". */
function YouMarker({location}: {location: LatLng}) {
  const [redraw, setRedraw] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setRedraw(false), MARKER_REDRAW_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      coordinate={location}
      anchor={{x: 0.5, y: YOU_DOT_SIZE / 2 / YOU_MARKER_HEIGHT}}
      tracksViewChanges={redraw}
      tappable={false}>
      <PinAnchor width={YOU_MARKER_WIDTH} pointY={YOU_DOT_SIZE / 2}>
        <View style={styles.you}>
          <View style={styles.youDot}>
            <View style={styles.youCenter} />
          </View>
          <Text style={styles.youLabel}>YOU</Text>
        </View>
      </PinAnchor>
    </Marker>
  );
}

const IS_IOS = Platform.OS === 'ios';

/**
 * Puts a custom pin's point on its map coordinate.
 *
 * On iOS (Apple Maps, new architecture) react-native-maps starts each custom
 * pin at zero size and only sizes it later, often not until a zoom. Until
 * then the pin's top-left corner sits on the coordinate, so the pin is drawn
 * down and to the right of the court. To avoid that, the native pin is kept
 * at zero size on purpose: the content hangs from a zero-size point and is
 * shifted so that (width / 2, pointY) lands on it.
 *
 * Android draws the pin as an image and uses the Marker's `anchor`, so this
 * is a plain wrapper there.
 */
function PinAnchor({
  width,
  pointY,
  style,
  children,
}: {
  /** Content width. */
  width: number;
  /** How far down the content the map point is. */
  pointY: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (!IS_IOS) {
    return <View style={style}>{children}</View>;
  }
  return (
    // collapsable={false} keeps this zero-size view from being optimized away.
    <View collapsable={false} style={[styles.anchorPoint, style]}>
      <View style={[styles.anchorContent, {left: -width / 2, top: -pointY}]}>{children}</View>
    </View>
  );
}

const YOU_DOT_SIZE = 16;
const YOU_LABEL_GAP = 4;
const YOU_LABEL_HEIGHT = 12;
const YOU_MARKER_HEIGHT = YOU_DOT_SIZE + YOU_LABEL_GAP + YOU_LABEL_HEIGHT;
const YOU_MARKER_WIDTH = 38;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    height: 82,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
  },
  wordmark: {
    // Figma: Anton 55/68, typed directly (close to MOTION / display).
    fontFamily: fonts.anton,
    fontSize: 55,
    color: colors.yellow,
  },
  area: {
    // Figma: Inter Bold 11/15, typed directly.
    fontFamily: fonts.interBold,
    fontSize: 11,
    lineHeight: 15,
    color: colors.text,
    marginTop: 15,
  },
  mapArea: {
    flex: 1,
    backgroundColor: colors.map,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: {
    position: 'absolute',
    top: 14,
    left: spacing.screen,
    right: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 23,
  },
  filter: {
    width: 148,
    height: sizes.control,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: sizes.border,
    borderColor: colors.line,
  },
  filterLabel: {
    // Figma: Inter Bold 13/18, typed directly.
    fontFamily: fonts.interBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  countLabel: {
    // Figma: Inter Bold 10/15, typed directly.
    fontFamily: fonts.interBold,
    fontSize: 10,
    lineHeight: 15,
    color: colors.text,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  bottomArea: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    bottom: 10,
  },
  recenter: {
    alignSelf: 'flex-end',
    // Figma: 102 above the hint card.
    marginBottom: 102,
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: sizes.border,
    borderColor: colors.line,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.xs,
    backgroundColor: colors.panel,
  },
  cardTitle: {
    ...typography.label,
    color: colors.yellow,
  },
  errorTitle: {
    color: colors.error,
  },
  cardBody: {
    ...typography.body,
    color: colors.muted,
  },
  courtCard: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    // Figma: 4 above the tab bar.
    bottom: spacing.xs,
  },
  anchorPoint: {
    width: 0,
    height: 0,
    overflow: 'visible',
  },
  anchorContent: {
    position: 'absolute',
  },
  you: {
    alignItems: 'center',
    width: YOU_MARKER_WIDTH,
    height: YOU_MARKER_HEIGHT,
    gap: YOU_LABEL_GAP,
  },
  youDot: {
    width: YOU_DOT_SIZE,
    height: YOU_DOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: sizes.border,
    borderColor: colors.text,
  },
  youCenter: {
    width: 6,
    height: 6,
    backgroundColor: colors.text,
  },
  youLabel: {
    // Figma: Inter Bold 9/12, typed directly.
    fontFamily: fonts.interBold,
    fontSize: 9,
    lineHeight: YOU_LABEL_HEIGHT,
    color: colors.text,
  },
});
