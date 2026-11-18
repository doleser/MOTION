import * as Location from 'expo-location';

import {setDemoLocation} from './demoLocation';
import {CHECK_IN_FIX_TIMEOUT_MS, getCheckInLocation} from './location';

jest.mock('expo-location', () => ({
  Accuracy: {High: 4, Balanced: 3},
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  enableNetworkProviderAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

const loc = Location as jest.Mocked<typeof Location>;
const court = {latitude: 47.6553, longitude: -122.3035};
const here = {coords: {latitude: 47.6554, longitude: -122.3036}};

function permission(status: string, canAskAgain: boolean) {
  return {status, canAskAgain} as unknown as Location.LocationPermissionResponse;
}

beforeEach(() => {
  jest.resetAllMocks();
  setDemoLocation(null);
  loc.hasServicesEnabledAsync.mockResolvedValue(true);
});

describe('getCheckInLocation', () => {
  it('returns a fresh reading and never the cached one', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permission('granted', true));
    loc.getCurrentPositionAsync.mockResolvedValue(here as Location.LocationObject);

    await expect(getCheckInLocation(court)).resolves.toEqual({
      ok: true,
      coords: {latitude: 47.6554, longitude: -122.3036},
    });
    expect(loc.getLastKnownPositionAsync).not.toHaveBeenCalled();
  });

  it('asks for permission when it can', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permission('undetermined', true));
    loc.requestForegroundPermissionsAsync.mockResolvedValue(permission('granted', true));
    loc.getCurrentPositionAsync.mockResolvedValue(here as Location.LocationObject);

    await expect(getCheckInLocation(court)).resolves.toMatchObject({ok: true});
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it('reports denied, and whether the popup can be shown again', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permission('denied', false));

    await expect(getCheckInLocation(court)).resolves.toEqual({
      ok: false,
      reason: 'denied',
      canAskAgain: false,
    });
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reports unavailable when there is no fix', async () => {
    loc.getForegroundPermissionsAsync.mockResolvedValue(permission('granted', true));
    loc.getCurrentPositionAsync.mockRejectedValue(new Error('Location services off'));

    await expect(getCheckInLocation(court)).resolves.toMatchObject({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('gives up after the timeout', async () => {
    jest.useFakeTimers();
    try {
      loc.getForegroundPermissionsAsync.mockResolvedValue(permission('granted', true));
      loc.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));

      const result = getCheckInLocation(court);
      await jest.advanceTimersByTimeAsync(CHECK_IN_FIX_TIMEOUT_MS);
      await expect(result).resolves.toMatchObject({ok: false, reason: 'unavailable'});
    } finally {
      jest.useRealTimers();
    }
  });

  describe('with a Prototype Controls override', () => {
    it('at_court sends the court itself without touching GPS', async () => {
      setDemoLocation('at_court');
      await expect(getCheckInLocation(court)).resolves.toEqual({ok: true, coords: court});
      expect(loc.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('too_far sends a reading over 150 m away', async () => {
      setDemoLocation('too_far');
      const result = await getCheckInLocation(court);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.coords.latitude - court.latitude).toBeGreaterThan(0.002);
      }
    });

    it('denied and unavailable fail without GPS', async () => {
      setDemoLocation('denied');
      await expect(getCheckInLocation(court)).resolves.toMatchObject({reason: 'denied'});
      setDemoLocation('unavailable');
      await expect(getCheckInLocation(court)).resolves.toMatchObject({reason: 'unavailable'});
      expect(loc.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    });
  });
});
