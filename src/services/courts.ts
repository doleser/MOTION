/**
 * Courts service.
 *
 * listCourts reads the `courts` table in Supabase. The map functions are
 * still STUBS with fake data until the backend has what they need; screens
 * won't change when they switch over:
 *
 *   getNearbyCourts -> supabase.rpc('nearby_courts', {lat, lng, radius, max_results})
 *                      (needs nearby_courts to return latitude/longitude)
 *   getCourt        -> supabase.rpc('get_court', {court_id})  (not written yet)
 *   subscribeToCourtCounts -> Realtime broadcast on 'court:<id>' (not set up yet)
 */
import {ServiceError} from './errors';
import {supabase} from './supabase';

/** Stub only: waits like a network request would. */
function fakeDelay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Court {
  id: number;
  name: string;
}

export type CourtStatus = 'active' | 'closed' | 'unverified';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** One court on the map. Same fields as a `nearby_courts` row. */
export interface CourtPin extends LatLng {
  id: number;
  name: string;
  status: CourtStatus;
  /** Players checked in right now. */
  playerCount: number;
  /** Average Elo of those players; null when nobody is there. */
  avgElo: number | null;
  /** Distance from the point that was searched around. */
  distanceMeters: number;
  /** A King of the Court session is running there. */
  sessionLive: boolean;
}

/** Everything the Court Details screen shows. */
export interface CourtDetails extends LatLng {
  id: number;
  name: string;
  status: CourtStatus;
  playerCount: number;
  avgElo: number | null;
  /** null means the data source didn't say. */
  indoor: boolean | null;
  lit: boolean | null;
  hoopCount: number | null;
  /** True for 2+ hoops; null when the hoop count is unknown. */
  isFullCourt: boolean | null;
  /** Neighborhood shown on the photo, e.g. "UW / MONTLAKE". */
  area: string | null;
  /** e.g. "UW access required · Check venue hours". */
  accessNote: string | null;
  /** Court photo URL. null until the backend stores photos. */
  photoUrl: string | null;
  /** Players who said they're heading here. */
  onTheWay: number;
  sessionLive: boolean;
}

/** The extra lines on the map's court card. */
export interface CourtPreview {
  /** e.g. "Indoor · Full court". Empty when nothing is known. */
  typeLine: string;
  /** e.g. "1V1 LIVE · 2 WAITING". */
  activityLine: string;
}

export interface NearbyCourtsQuery extends LatLng {
  /** Only courts this close. The server caps it at 50 km. */
  radiusMeters: number;
  /** Return at most this many, closest first. */
  maxResults?: number;
}

export interface CourtCountUpdate {
  courtId: number;
  playerCount: number;
}

// ---------- Fake data ----------

interface StubCourt extends LatLng {
  id: number;
  name: string;
  status: CourtStatus;
  indoor: boolean | null;
  lit: boolean | null;
  hoopCount: number | null;
}

/**
 * Same courts, in the same order, as supabase/seed.sql. The ids assume the
 * database numbers them 1, 2, 3... in insert order.
 */
const STUB_COURTS: readonly StubCourt[] = [
  {id: 1, name: 'Denny Courts', latitude: 47.660225, longitude: -122.306971, status: 'active', indoor: false, lit: true, hoopCount: 2},
  {id: 2, name: 'Laurelhurst Half Court', latitude: 47.653557, longitude: -122.280612, status: 'active', indoor: false, lit: null, hoopCount: 1},
  {id: 3, name: 'Ravenna Park', latitude: 47.672905, longitude: -122.310858, status: 'active', indoor: false, lit: false, hoopCount: 2},
  {id: 4, name: 'Green Lake Half Court', latitude: 47.680037, longitude: -122.328433, status: 'active', indoor: false, lit: false, hoopCount: 1},
  {id: 5, name: 'Green Lake Full Court', latitude: 47.680018, longitude: -122.328146, status: 'active', indoor: false, lit: true, hoopCount: 2},
  {id: 6, name: 'UW IMA', latitude: 47.653522, longitude: -122.301431, status: 'active', indoor: true, lit: true, hoopCount: null},
];

/** Fake live player counts. The stub subscription changes these. */
const stubPlayerCounts = new Map<number, number>([
  [1, 3],
  [2, 0],
  [3, 6],
  [4, 0],
  [5, 2],
  [6, 12],
]);

interface CourtExtras {
  area: string | null;
  accessNote: string | null;
  onTheWay: number;
  sessionLive: boolean;
  /** Players waiting in the King of the Court queue. */
  kotcWaiting: number;
  /** Overrides the hoop-count rule when the hoop count is unknown. */
  isFullCourt?: boolean;
}

// TODO(backend): replace with real columns/tables. The database has no
// neighborhood, access note, "heading here" claims, or sessions yet, so these
// are hard-coded for the seed courts.
const COURT_EXTRAS: Readonly<Record<number, CourtExtras>> = {
  1: {area: 'UW / U DISTRICT', accessNote: null, onTheWay: 1, sessionLive: false, kotcWaiting: 0},
  2: {area: 'LAURELHURST', accessNote: null, onTheWay: 0, sessionLive: false, kotcWaiting: 0},
  3: {area: 'RAVENNA', accessNote: null, onTheWay: 2, sessionLive: false, kotcWaiting: 0},
  4: {area: 'GREEN LAKE', accessNote: null, onTheWay: 0, sessionLive: false, kotcWaiting: 0},
  5: {area: 'GREEN LAKE', accessNote: null, onTheWay: 0, sessionLive: false, kotcWaiting: 0},
  6: {
    area: 'UW / MONTLAKE',
    accessNote: 'UW access required · Check venue hours',
    onTheWay: 3,
    sessionLive: true,
    kotcWaiting: 2,
    isFullCourt: true,
  },
};

const NO_EXTRAS: CourtExtras = {area: null, accessNote: null, onTheWay: 0, sessionLive: false, kotcWaiting: 0};

/**
 * Straight-line distance in meters (haversine). The stub filters with it, and
 * the map uses it to decide when to search again. Court distances shown to
 * users come from the server.
 */
export function distanceBetween(a: LatLng, b: LatLng): number {
  const earthRadius = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function playerCountOf(courtId: number): number {
  return stubPlayerCounts.get(courtId) ?? 0;
}

// ---------- Public API ----------

/**
 * Every open court, for the home court picker, in the order they were added.
 * Works while signed out (anyone can read courts).
 */
export async function listCourts(): Promise<Court[]> {
  const {data, error} = await supabase
    .from('courts')
    .select('court_id, name')
    .eq('status', 'active')
    .order('court_id');
  if (error) {
    throw error;
  }
  return data.map((row) => ({id: row.court_id, name: row.name}));
}

/**
 * The courts closest to a point, closest first, with live player counts.
 * Works while signed out (the map is public).
 */
export async function getNearbyCourts({
  latitude,
  longitude,
  radiusMeters,
  maxResults = 10,
}: NearbyCourtsQuery): Promise<CourtPin[]> {
  await fakeDelay(300);
  const center = {latitude, longitude};
  return STUB_COURTS.map((court) => ({
    id: court.id,
    name: court.name,
    status: court.status,
    latitude: court.latitude,
    longitude: court.longitude,
    playerCount: playerCountOf(court.id),
    // Stub: no fake Elo.
    avgElo: null,
    distanceMeters: distanceBetween(center, court),
    sessionLive: (COURT_EXTRAS[court.id] ?? NO_EXTRAS).sessionLive,
  }))
    .filter((court) => court.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, maxResults);
}

/** One court's details. Throws 'court_not_found' for an unknown id. */
export async function getCourt(courtId: number): Promise<CourtDetails> {
  await fakeDelay();
  const court = STUB_COURTS.find((c) => c.id === courtId);
  if (!court) {
    throw new ServiceError('court_not_found', "We couldn't find that court.");
  }
  const extras = COURT_EXTRAS[court.id] ?? NO_EXTRAS;
  return {
    ...court,
    playerCount: playerCountOf(court.id),
    avgElo: null,
    isFullCourt:
      extras.isFullCourt ?? (court.hoopCount === null ? null : court.hoopCount >= 2),
    area: extras.area,
    accessNote: extras.accessNote,
    photoUrl: null,
    onTheWay: extras.onTheWay,
    sessionLive: extras.sessionLive,
  };
}

/**
 * The court type and activity lines for the map's court card. The live
 * player count comes from the map pin, not from here.
 *
 * TODO(backend): hard-coded from the stub data until courts have these
 * columns and King of the Court sessions exist.
 */
export function getCourtPreview(courtId: number, playerCount: number): CourtPreview {
  const court = STUB_COURTS.find((c) => c.id === courtId);
  const extras = COURT_EXTRAS[courtId] ?? NO_EXTRAS;

  let typeLine = '';
  if (court) {
    const isFullCourt =
      extras.isFullCourt ?? (court.hoopCount === null ? null : court.hoopCount >= 2);
    const parts = [
      court.indoor === null ? null : court.indoor ? 'Indoor' : 'Outdoor',
      isFullCourt === null ? null : isFullCourt ? 'Full court' : 'Half court',
    ];
    typeLine = parts.filter((part) => part !== null).join(' · ');
  }

  let activityLine: string;
  if (extras.sessionLive) {
    activityLine = `1V1 LIVE · ${extras.kotcWaiting} WAITING`;
  } else if (playerCount > 0) {
    activityLine = 'PICKUP ACTIVE · NO KOTC SESSION';
  } else {
    // Not in Figma.
    activityLine = 'NO ONE HERE YET';
  }
  return {typeLine, activityLine};
}

/** How often the stub pretends someone checks in or out. */
const STUB_UPDATE_MS = 5000;

/**
 * Calls `onUpdate` whenever the player count changes at one of `courtIds`.
 * Returns a function that stops listening; call it on unmount.
 *
 * Stub: every few seconds, one of the courts gains or loses a player.
 */
export function subscribeToCourtCounts(
  courtIds: readonly number[],
  onUpdate: (update: CourtCountUpdate) => void,
): () => void {
  if (courtIds.length === 0) {
    return () => {};
  }
  const timer = setInterval(() => {
    const courtId = courtIds[Math.floor(Math.random() * courtIds.length)];
    const current = playerCountOf(courtId);
    const next = Math.max(0, current + (Math.random() < 0.5 ? -1 : 1));
    stubPlayerCounts.set(courtId, next);
    onUpdate({courtId, playerCount: next});
  }, STUB_UPDATE_MS);
  return () => clearInterval(timer);
}
