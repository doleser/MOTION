/**
 * Builds alternative handles to suggest when the one a user wants is taken.
 *
 * getHandleCandidates is pure (no service calls). findFreeHandle checks all
 * the candidates in one call to an availability check that's passed in, so
 * it can be tested with a fake.
 */
import {USERNAME_PATTERN} from '../../services/profile';

/** Longest handle allowed (USERNAME_PATTERN's upper limit). */
const MAX_LENGTH = 16;

/** Endings to try, in order. Kept short so most names still fit. */
const SUFFIXES = ['_1', '2', '_sea', '_hoops', '23', '_uw', '3', '_ball'];

/**
 * Candidate handles based on `handle`, best first. Every candidate follows
 * the username rule and differs from `handle` (ignoring case). Returns an
 * empty list if nothing usable can be made.
 */
export function getHandleCandidates(handle: string): string[] {
  // Keep only allowed characters, so any input gives valid candidates.
  const base = handle.replace(/[^A-Za-z0-9_]/g, '');
  if (base.length === 0) {
    return [];
  }

  const seen = new Set([base.toLowerCase()]);
  const candidates: string[] = [];
  for (const suffix of SUFFIXES) {
    // Shorten the base so base + suffix stays within the length limit.
    const candidate = base.slice(0, MAX_LENGTH - suffix.length) + suffix;
    const key = candidate.toLowerCase();
    if (USERNAME_PATTERN.test(candidate) && !seen.has(key)) {
      seen.add(key);
      candidates.push(candidate);
    }
  }
  return candidates;
}

/**
 * Given a list of handles, answers with the ones that are free (the real
 * one is getAvailableUsernames). One call for the whole list.
 */
export type GetAvailableHandles = (handles: string[]) => Promise<string[]>;

/**
 * The best candidate for `handle` that `getAvailable` says is free, or null
 * if none are. All candidates are checked in ONE call, so it's one request
 * to the backend however many of them are taken.
 *
 * Never returns a handle the check didn't confirm as free, so the user is
 * never told a taken name is OK. If the check fails, returns null (no
 * suggestion) rather than guessing.
 *
 * `getAvailable` is passed in so tests can use a fake; the screen passes the
 * real service, which will ask the database once the backend is connected.
 */
export async function findFreeHandle(
  handle: string,
  getAvailable: GetAvailableHandles,
  exclude: readonly string[] = [],
): Promise<string | null> {
  const excluded = new Set(exclude.map((name) => name.toLowerCase()));
  const candidates = getHandleCandidates(handle).filter(
    (candidate) => !excluded.has(candidate.toLowerCase()),
  );
  if (candidates.length === 0) {
    return null;
  }

  let free: string[];
  try {
    free = await getAvailable(candidates);
  } catch {
    return null;
  }
  const freeLower = new Set(free.map((name) => name.toLowerCase()));
  // Keep our best-first order, whatever order the answer comes back in.
  return candidates.find((candidate) => freeLower.has(candidate.toLowerCase())) ?? null;
}
