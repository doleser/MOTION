import {
  distanceBetween,
  getCourt,
  getCourtPreview,
  getNearbyCourts,
  listCourts,
  subscribeToCourtCounts,
} from './courts';
import {supabase} from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;
const channel = supabase.channel as jest.Mock;
const removeChannel = supabase.removeChannel as jest.Mock;

beforeEach(() => jest.resetAllMocks());

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

/** A row as `nearby_courts` returns it. */
function nearbyRow(overrides: Record<string, unknown> = {}) {
  return {
    court_id: 3,
    name: 'Ravenna Park',
    latitude: 47.672905,
    longitude: -122.310858,
    status: 'active',
    player_count: 6,
    avg_elo: 900,
    distance_m: 1800,
    ...overrides,
  };
}

describe('getNearbyCourts', () => {
  it('asks the database for courts near the point and renames the fields', async () => {
    rpc.mockResolvedValue({data: [nearbyRow()], error: null});

    const courts = await getNearbyCourts({...UW, radiusMeters: 20000});

    expect(rpc).toHaveBeenCalledWith('nearby_courts', {
      p_lat: UW.latitude,
      p_lng: UW.longitude,
      p_radius_m: 20000,
      p_limit: 10,
    });
    expect(courts).toEqual([
      {
        id: 3,
        name: 'Ravenna Park',
        status: 'active',
        latitude: 47.672905,
        longitude: -122.310858,
        playerCount: 6,
        avgElo: 900,
        distanceMeters: 1800,
        sessionLive: false,
      },
    ]);
  });

  it('passes maxResults through as the limit', async () => {
    rpc.mockResolvedValue({data: [], error: null});
    await getNearbyCourts({...UW, radiusMeters: 20000, maxResults: 2});
    expect(rpc).toHaveBeenCalledWith(
      'nearby_courts',
      expect.objectContaining({p_limit: 2}),
    );
  });

  it('keeps the order the database sent (closest first) and a missing avg Elo', async () => {
    rpc.mockResolvedValue({
      data: [
        nearbyRow({court_id: 6, name: 'UW IMA', avg_elo: null, distance_m: 300}),
        nearbyRow({court_id: 1, name: 'Denny Courts', distance_m: 900}),
      ],
      error: null,
    });

    const courts = await getNearbyCourts({...UW, radiusMeters: 20000});

    expect(courts.map((court) => court.name)).toEqual(['UW IMA', 'Denny Courts']);
    expect(courts[0].avgElo).toBeNull();
  });

  it('throws when the request fails', async () => {
    const failure = {message: 'network down'};
    rpc.mockResolvedValue({data: null, error: failure});
    await expect(getNearbyCourts({...UW, radiusMeters: 1000})).rejects.toBe(failure);
  });
});

/** A row as `get_court` returns it. */
function detailsRow(overrides: Record<string, unknown> = {}) {
  return {
    court_id: 3,
    name: 'Ravenna Park',
    latitude: 47.672905,
    longitude: -122.310858,
    status: 'active',
    player_count: 6,
    avg_elo: 900,
    lit: false,
    indoor: false,
    hoop_count: 2,
    ...overrides,
  };
}

describe('getCourt', () => {
  it('asks the database for the court and returns its details', async () => {
    rpc.mockResolvedValue({data: [detailsRow()], error: null});

    const ravenna = await getCourt(3);

    expect(rpc).toHaveBeenCalledWith('get_court', {p_court_id: 3});
    expect(ravenna).toEqual(
      expect.objectContaining({
        id: 3,
        name: 'Ravenna Park',
        playerCount: 6,
        avgElo: 900,
        indoor: false,
        lit: false,
        hoopCount: 2,
      }),
    );
  });

  it('works out the full-court rule from the hoop count', async () => {
    rpc.mockResolvedValue({data: [detailsRow({hoop_count: 2})], error: null});
    expect((await getCourt(3)).isFullCourt).toBe(true);

    rpc.mockResolvedValue({data: [detailsRow({court_id: 2, hoop_count: 1})], error: null});
    expect((await getCourt(2)).isFullCourt).toBe(false);

    rpc.mockResolvedValue({data: [detailsRow({court_id: 99, hoop_count: null})], error: null});
    expect((await getCourt(99)).isFullCourt).toBeNull();
  });

  it("throws 'court_not_found' when the database says so", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {code: '22023', message: 'Court not found.'},
    });
    await expect(getCourt(999)).rejects.toMatchObject({code: 'court_not_found'});
  });

  it("throws 'court_not_found' when no row comes back", async () => {
    rpc.mockResolvedValue({data: [], error: null});
    await expect(getCourt(999)).rejects.toMatchObject({code: 'court_not_found'});
  });

  it('throws other errors as they are', async () => {
    const failure = {message: 'network down'};
    rpc.mockResolvedValue({data: null, error: failure});
    await expect(getCourt(3)).rejects.toBe(failure);
  });
});

/**
 * Fakes supabase.channel(name).on(...).subscribe(), one fake channel per name.
 * `send` pretends the database broadcast a count on that channel.
 */
function mockChannels() {
  const handlers = new Map<string, (message: {payload: unknown}) => void>();
  channel.mockImplementation((name: string) => {
    const fake: {on: jest.Mock; subscribe: jest.Mock} = {
      on: jest.fn(),
      subscribe: jest.fn(),
    };
    fake.on.mockImplementation(
      (_type: string, _filter: unknown, callback: (m: {payload: unknown}) => void) => {
        handlers.set(name, callback);
        return fake;
      },
    );
    fake.subscribe.mockReturnValue(fake);
    return fake;
  });
  return {
    send: (name: string, payload: unknown) => handlers.get(name)?.({payload}),
  };
}

describe('subscribeToCourtCounts', () => {
  it('listens to each court and reports count changes until unsubscribed', () => {
    const fake = mockChannels();
    const onUpdate = jest.fn();

    const unsubscribe = subscribeToCourtCounts([1, 3], onUpdate);

    expect(channel).toHaveBeenCalledWith('court:1', {config: {private: true}});
    expect(channel).toHaveBeenCalledWith('court:3', {config: {private: true}});
    fake.send('court:3', {courtId: 3, playerCount: 7});
    expect(onUpdate).toHaveBeenCalledWith({courtId: 3, playerCount: 7});

    unsubscribe();
    expect(removeChannel).toHaveBeenCalledTimes(2);
  });

  it('does nothing for an empty list', () => {
    mockChannels();
    const onUpdate = jest.fn();
    subscribeToCourtCounts([], onUpdate)();
    expect(channel).not.toHaveBeenCalled();
    expect(removeChannel).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('getCourtPreview', () => {
  it('shows a live King of the Court session (Figma: IMA card)', () => {
    expect(getCourtPreview(6, 12)).toEqual({
      typeLine: 'Indoor · Full court',
      activityLine: '1V1 LIVE · 2 WAITING',
    });
  });

  it('shows pickup when players are there without a session (Figma: Ravenna card)', () => {
    // Figma says "Outdoor court"; we always name the court size when we know it.
    expect(getCourtPreview(3, 6)).toEqual({
      typeLine: 'Outdoor · Full court',
      activityLine: 'PICKUP ACTIVE · NO KOTC SESSION',
    });
  });

  it('says when nobody is there', () => {
    expect(getCourtPreview(2, 0)).toEqual({
      typeLine: 'Outdoor · Half court',
      activityLine: 'NO ONE HERE YET',
    });
  });
});
