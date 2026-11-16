/**
 * TEMPORARY fake players shared by the players.ts and challenges.ts stubs.
 * Delete once both services call the real backend.
 */
import type {GameResult, PlayerRecord} from './records';

export interface FakePlayer {
  userId: string;
  realName: string;
  username: string;
  elo: number;
  /** False = started sign-up but never finished (no onboarded_at). */
  finishedSignUp: boolean;
  openToChallenges: boolean;
  record: PlayerRecord;
}

/** A fake record. `form` is the recent results, oldest first. */
function fakeRecord(wins: number, losses: number, form: GameResult[]): PlayerRecord {
  // The streak is the run of identical results at the newest end.
  const newest = form[form.length - 1];
  let count = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === newest; i--) {
    count++;
  }
  return {wins, losses, streak: newest ? {result: newest, count} : null, recentResults: form};
}

// What each fake player tests on their profile (their challenges with the
// user are in challenges.ts):
//   mayac: not accepting challenges · samr: declined you recently
//   devs, johnny_n, mwebb_23: challenge pending (noahk: free to challenge)
//   johanna, jo_bell, hoopdreams: Send fails
//   hoopdreams: no games yet (dashes and empty form squares)
export const FAKE_PLAYERS: FakePlayer[] = [
  {userId: 'fake-1', realName: 'Noah Kim', username: 'noahk', elo: 1506, finishedSignUp: true, openToChallenges: true, record: fakeRecord(18, 12, ['W', 'L', 'L', 'W', 'W'])},
  {userId: 'fake-2', realName: 'Maya Chen', username: 'mayac', elo: 1350, finishedSignUp: true, openToChallenges: false, record: fakeRecord(9, 7, ['L', 'W', 'W', 'L', 'W'])},
  {userId: 'fake-3', realName: 'Dev Shah', username: 'devs', elo: 1398, finishedSignUp: true, openToChallenges: true, record: fakeRecord(14, 10, ['W', 'W', 'L', 'L', 'L'])},
  {userId: 'fake-4', realName: 'Sam Rivera', username: 'samr', elo: 1284, finishedSignUp: true, openToChallenges: true, record: fakeRecord(6, 9, ['L', 'L', 'W', 'L', 'W'])},
  {userId: 'fake-5', realName: 'Johnny Nguyen', username: 'johnny_n', elo: 1420, finishedSignUp: true, openToChallenges: true, record: fakeRecord(21, 15, ['W', 'W', 'W', 'L', 'W'])},
  {userId: 'fake-6', realName: 'John Park', username: 'JohnP', elo: 1210, finishedSignUp: true, openToChallenges: true, record: fakeRecord(3, 8, ['L', 'W', 'L', 'L', 'L'])},
  {userId: 'fake-7', realName: 'Johanna Lee', username: 'johanna', elo: 1462, finishedSignUp: true, openToChallenges: true, record: fakeRecord(25, 11, ['W', 'W', 'W', 'W', 'L'])},
  {userId: 'fake-8', realName: 'Jordan Bell', username: 'jo_bell', elo: 1175, finishedSignUp: true, openToChallenges: true, record: fakeRecord(2, 3, ['W', 'L', 'L'])},
  {userId: 'fake-9', realName: 'Andre Hollis', username: 'hoopdreams', elo: 1330, finishedSignUp: true, openToChallenges: true, record: fakeRecord(0, 0, [])},
  {userId: 'fake-10', realName: 'Marcus Webb', username: 'mwebb_23', elo: 1555, finishedSignUp: true, openToChallenges: true, record: fakeRecord(31, 9, ['W', 'W', 'W', 'W', 'W'])},
  // Never finished sign-up, so search must leave them out ("jo" won't find them).
  {userId: 'fake-11', realName: 'Joey Unfinished', username: 'joey_u', elo: 1200, finishedSignUp: false, openToChallenges: true, record: fakeRecord(0, 0, [])},
];

/**
 * A fake player who finished sign-up, or undefined.
 */
export function getFakePlayer(userId: string): FakePlayer | undefined {
  return FAKE_PLAYERS.find((player) => player.userId === userId && player.finishedSignUp);
}
