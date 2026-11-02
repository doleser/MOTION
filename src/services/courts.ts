/**
 * Courts service (STUB).
 *
 * A fake stand-in for the `courts` table. The real version will call
 * Supabase (e.g. a nearby-courts function); screens won't change.
 */
import {fakeDelay} from './fakeDelay';

export interface Court {
  id: number;
  name: string;
}

/**
 * Same courts, in the same order, as supabase/seed.sql. The ids assume the
 * database numbers them 1, 2, 3... in insert order.
 */
const STUB_COURTS: readonly Court[] = [
  {id: 1, name: 'Denny Courts'},
  {id: 2, name: 'Laurelhurst Half Court'},
  {id: 3, name: 'Ravenna Park'},
  {id: 4, name: 'Green Lake Half Court'},
  {id: 5, name: 'Green Lake Full Court'},
  {id: 6, name: 'UW IMA'},
];

/** Every court, for the home court picker. Works while signed out. */
export async function listCourts(): Promise<Court[]> {
  await fakeDelay();
  return [...STUB_COURTS];
}
