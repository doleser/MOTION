import {
  distanceBetween,
  getCourt,
  getNearbyCourts,
  listCourts,
  subscribeToCourtCounts,
} from './courts';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({supabase: {from: jest.fn()}}));

const from = supabase.from as jest.Mock;

/** Fakes supabase.from('courts').select(...).eq(...).order(...). */
function mockCourtsQuery(result: {data: unknown; error: unknown}) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  };
  from.mockReturnValue(query);
  return query;
}

describe('listCourts', () => {
  it('reads open courts and renames court_id to id', async () => {
    const query = mockCourtsQuery({
      data: [
        {court_id: 1, name: 'Denny Courts'},
        {court_id: 6, name: 'UW IMA'},
      ],
      error: null,
    });

    await expect(listCourts()).resolves.toEqual([
      {id: 1, name: 'Denny Courts'},
      {id: 6, name: 'UW IMA'},
    ]);
    expect(from).toHaveBeenCalledWith('courts');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('throws when the request fails', async () => {
    const failure = {message: 'network down'};
    mockCourtsQuery({data: null, error: failure});
    await expect(listCourts()).rejects.toBe(failure);
  });
});

/** Center of the UW campus. */
const UW = {latitude: 47.6553, longitude: -122.3035};

describe('distanceBetween', () => {
  it('is zero for the same point and about 111 km per degree of latitude', () => {
    expect(distanceBetween(UW, UW)).toBe(0);
    const oneDegreeNorth = {...UW, latitude: UW.latitude + 1};
    expect(distanceBetween(UW, oneDegreeNorth)).toBeGreaterThan(110000);
    expect(distanceBetween(UW, oneDegreeNorth)).toBeLessThan(112000);
  });
});

describe('getNearbyCourts', () => {
  it('returns courts closest first, with coordinates', async () => {
    const courts = await getNearbyCourts({...UW, radiusMeters: 20000});
    expect(courts.length).toBeGreaterThan(0);
    for (let i = 1; i < courts.length; i++) {
      expect(courts[i].distanceMeters).toBeGreaterThanOrEqual(courts[i - 1].distanceMeters);
    }
    expect(courts[0]).toEqual(
      expect.objectContaining({latitude: expect.any(Number), longitude: expect.any(Number)}),
    );
  });

  it('returns at most maxResults courts', async () => {
    const courts = await getNearbyCourts({...UW, radiusMeters: 20000, maxResults: 2});
    expect(courts).toHaveLength(2);
  });

  it('leaves out courts outside the radius', async () => {
    const courts = await getNearbyCourts({...UW, radiusMeters: 1000});
    expect(courts.every((court) => court.distanceMeters <= 1000)).toBe(true);
    expect(courts.map((court) => court.name)).not.toContain('Green Lake Full Court');
  });
});

describe('getCourt', () => {
  it('returns details, with the full-court rule from the hoop count', async () => {
    const ravenna = await getCourt(3);
    expect(ravenna.name).toBe('Ravenna Park');
    expect(ravenna.isFullCourt).toBe(true);
    const laurelhurst = await getCourt(2);
    expect(laurelhurst.isFullCourt).toBe(false);
  });

  it("throws 'court_not_found' for an unknown id", async () => {
    await expect(getCourt(999)).rejects.toMatchObject({code: 'court_not_found'});
  });
});

describe('subscribeToCourtCounts', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reports count changes for the given courts until unsubscribed', () => {
    const onUpdate = jest.fn();
    const unsubscribe = subscribeToCourtCounts([1, 3], onUpdate);
    jest.advanceTimersByTime(5000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect([1, 3]).toContain(onUpdate.mock.calls[0][0].courtId);

    unsubscribe();
    jest.advanceTimersByTime(20000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an empty list', () => {
    const onUpdate = jest.fn();
    subscribeToCourtCounts([], onUpdate)();
    jest.advanceTimersByTime(20000);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
