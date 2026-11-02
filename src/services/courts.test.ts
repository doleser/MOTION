import {listCourts} from './courts';

describe('listCourts', () => {
  it('returns the seed.sql courts with unique ids', async () => {
    const courts = await listCourts();
    expect(courts.map((court) => court.name)).toContain('UW IMA');
    expect(new Set(courts.map((court) => court.id)).size).toBe(courts.length);
  });
});
