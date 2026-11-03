/**
 * Profiles service: reads the `profiles` table in Supabase.
 */
import {supabase} from './supabase';

// username
// position
// elo
// win/loss
// win rate
// win streak
// recent form (last 5 matches)

export interface Profile {
  id: number;
  username: string;
  position: string;
  elo: number;
  winLoss: string;
  winRate: number;
  winStreak: number;
  recentForm: string;
}

/**
 * Get a profile by its ID.
 * @param input - An object containing the ID of the profile to retrieve.
 * @returns The profile of the user with the specified ID.
 */
export async function getProfile(input: {id: number}): Promise<Profile[]> {
  const {data, error} = await supabase
    .from('profiles')
    .select('user_id, name, username, position, elo, win_loss, win_rate, win_streak, recent_form')
    .eq('user_id', input.id)
    .order('user_id');
  if (error) {
    throw error;
  }
  return data.map((row) => ({
    id: row.user_id,
    username: row.username,
    position: row.position,
    elo: row.elo,
    winLoss: row.win_loss,
    winRate: row.win_rate,
    winStreak: row.win_streak,
    recentForm: row.recent_form,
  }));
}

/**
 * Update a profile by its ID.
 * @param input - An object containing the ID and the fields to update.
 * @returns void
 */
export async function updateProfile(input: Partial<Profile>): Promise<void> {
  const {error} = await supabase
    .from('profiles')
    .update({
      username: input.username,
      position: input.position,
      elo: input.elo,
      win_loss: input.winLoss,
      win_rate: input.winRate,
      win_streak: input.winStreak,
      recent_form: input.recentForm,
    })
    .eq('user_id', input.id);
  if (error) {
    throw error;
  }
}
