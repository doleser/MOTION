/**
 * Courts service: reads the `courts` table in Supabase.
 */
import {supabase} from './supabase';

export interface Court {
  id: number;
  name: string;
}

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
