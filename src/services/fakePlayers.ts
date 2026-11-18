/**
 * TEMPORARY fake players for the challenges.ts stub: the other players in
 * the seeded challenges. Search and profiles are real now, so these can't
 * be found in search. Delete once challenges.ts calls the real backend.
 */

export interface FakePlayer {
  userId: string;
  realName: string;
  username: string;
  elo: number;
  openToChallenges: boolean;
}

// Their challenges with the user are in challenges.ts.
export const FAKE_PLAYERS: FakePlayer[] = [
  {userId: 'fake-1', realName: 'Noah Kim', username: 'noahk', elo: 1506, openToChallenges: true},
  {userId: 'fake-2', realName: 'Maya Chen', username: 'mayac', elo: 1350, openToChallenges: false},
  {userId: 'fake-3', realName: 'Dev Shah', username: 'devs', elo: 1398, openToChallenges: true},
  {userId: 'fake-4', realName: 'Sam Rivera', username: 'samr', elo: 1284, openToChallenges: true},
  {userId: 'fake-5', realName: 'Johnny Nguyen', username: 'johnny_n', elo: 1420, openToChallenges: true},
  {userId: 'fake-6', realName: 'John Park', username: 'JohnP', elo: 1210, openToChallenges: true},
  {userId: 'fake-7', realName: 'Johanna Lee', username: 'johanna', elo: 1462, openToChallenges: true},
  {userId: 'fake-8', realName: 'Jordan Bell', username: 'jo_bell', elo: 1175, openToChallenges: true},
  {userId: 'fake-9', realName: 'Andre Hollis', username: 'hoopdreams', elo: 1330, openToChallenges: true},
  {userId: 'fake-10', realName: 'Marcus Webb', username: 'mwebb_23', elo: 1555, openToChallenges: true},
];

/** A fake player, or undefined. */
export function getFakePlayer(userId: string): FakePlayer | undefined {
  return FAKE_PLAYERS.find((player) => player.userId === userId);
}
