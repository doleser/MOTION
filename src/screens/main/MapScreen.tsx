import {useIsFocused} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {memo, useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, type MapPressEvent, type Region} from 'react-native-maps';
import {SafeAreaView} from 'react-native-safe-area-context';
import {SvgIcon} from '../../components/SvgIcon';

import {
  COURT_MARKER_HEIGHT,
  COURT_MARKER_SIZE,
  CourtMarker,
  type CourtMarkerState,
} from '../../components/CourtMarker';
import type {MapScreenProps} from '../../navigation/types';
import type {CourtPin, LatLng} from '../../services/courts';
import {DEFAULT_LOCATION, getCurrentLocation} from '../../services/location';
import {colors, fonts, opacity, sizes, spacing, typography} from '../../theme';
import {darkMapStyle} from './darkMapStyle';
import {useCourtCounts} from './useCourtCounts';
import {useNearbyCourts} from './useNearbyCourts';

// Recenter icon, downloaded from Figma ("Icon / target").
const targetIcon = require('../../../assets/icons/target.svg');

/** How far the map is zoomed when it opens or recenters (about 4 km tall). */
const START_DELTA = 0.04;

/** A map tap this close (in points) to a court's tile opens that court. */
const TAP_RADIUS = 40;
/** Ignore a second open within this long (one tap can fire two handlers). */
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

  // Open a court, at most once per tap. On iOS a tap on a pin can reach
  // both the pin's onPress and the map's onPress.
  const lastOpenedAt = useRef(0);
  const openCourt = useCallback(
    (courtId: number) => {
      const now = Date.now();
      if (now - lastOpenedAt.current < OPEN_COOLDOWN_MS) {
        return;
      }
      lastOpenedAt.current = now;
      navigation.navigate('CourtDetails', {courtId});
    },
    [navigation],
  );

  const shownCourts = activeOnly ? courts.filter((court) => court.playerCount > 0) : courts;

  // Backup for pin taps: the pin's own onPress often misses on iOS (for
  // example on a pin that was tapped before). Open the court whose tile is
  // closest to the tap, if it's within TAP_RADIUS.
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
      let nearestId: number | null = null;
      let nearestDistance = TAP_RADIUS;
      points.forEach((point, i) => {
        const distance = Math.hypot(point.x - tap.x, point.y - tap.y);
        if (distance <= nearestDistance) {
          nearestDistance = distance;
          nearestId = shownCourts[i].id;
        }
      });
      if (nearestId !== null) {
        openCourt(nearestId);
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
            {shownCourts.map((court) => (
              <CourtMapPin key={court.id} court={court} onOpen={openCourt} />
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
            <SvgIcon asset={targetIcon} />
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
                Tap a court for live counts and activity. Player details stay private until
                check-in.
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function markerStateOf(court: CourtPin): CourtMarkerState {
  if (court.sessionLive) {
    return 'live';
  }
  return court.playerCount > 0 ? 'active' : 'empty';
}

/** Long enough for a custom marker to finish drawing before it's frozen. */
const MARKER_REDRAW_MS = 500;

/**
 * One court on the map. Custom markers are redrawn only for a moment after
 * their count changes (`tracksViewChanges`), which keeps panning smooth.
 */
const CourtMapPin = memo(function CourtMapPin({
  court,
  onOpen,
}: {
  court: CourtPin;
  onOpen: (courtId: number) => void;
}) {
  const state = markerStateOf(court);
  // Redraw whenever what the pin shows differs from what was last frozen.
  const look = `${court.playerCount}/${state}`;
  const [frozenLook, setFrozenLook] = useState<string | null>(null);
  const redraw = frozenLook !== look;

  useEffect(() => {
    const timer = setTimeout(() => setFrozenLook(look), MARKER_REDRAW_MS);
    return () => clearTimeout(timer);
  }, [look]);

  return (
    <Marker
      coordinate={{latitude: court.latitude, longitude: court.longitude}}
      // Point at the middle of the tile, not the middle of tile + name.
      // `anchor` is for Google Maps; Apple Maps uses `centerOffset`.
      anchor={{x: 0.5, y: COURT_MARKER_SIZE / 2 / COURT_MARKER_HEIGHT}}
      centerOffset={{x: 0, y: COURT_MARKER_HEIGHT / 2 - COURT_MARKER_SIZE / 2}}
      tracksViewChanges={redraw}
      onPress={() => onOpen(court.id)}
      accessibilityLabel={`${court.name}, ${court.playerCount} playing`}>
      <View style={court.status === 'closed' ? styles.closedPin : undefined}>
        <CourtMarker
          playerCount={court.playerCount}
          state={state}
          label={court.name.toUpperCase()}
        />
      </View>
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
      <View style={styles.you}>
        <View style={styles.youDot}>
          <View style={styles.youCenter} />
        </View>
        <Text style={styles.youLabel}>YOU</Text>
      </View>
    </Marker>
  );
}

const YOU_DOT_SIZE = 16;
const YOU_LABEL_GAP = 4;
const YOU_LABEL_HEIGHT = 12;
const YOU_MARKER_HEIGHT = YOU_DOT_SIZE + YOU_LABEL_GAP + YOU_LABEL_HEIGHT;

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
  closedPin: {
    opacity: opacity.disabled,
  },
  you: {
    alignItems: 'center',
    width: 38,
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
