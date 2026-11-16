/**
 * Rules for player search queries. Pure functions (no server calls), so the
 * screen can use them on every keystroke and they're easy to test.
 *
 * The future search_players database function must follow the same rules.
 */

/**
 * The longest a username can be. Matches USERNAME_PATTERN in profile.ts
 * (3-16 letters, numbers, or underscores), so a longer query can't match.
 */
const MAX_USERNAME_LENGTH = 16;

/** Characters a username can have. Same set as USERNAME_PATTERN in profile.ts. */
 * search_players checks this same alphabet and 16-character cap. The
 * 3-character username minimum (username_format / USERNAME_PATTERN) does
 * not apply here: a one-character prefix is a valid search.
 */

/**
 * Same 16-character cap as username_format. The 3-character username
 * minimum does not apply to search, so a longer query can't match and a
 * one-character query can.
 */
const MAX_USERNAME_LENGTH = 16;

/**
 * Same characters as username_format (A-Z, 0-9, _). The 3-character
 * username minimum does not apply to search.
 */
const USERNAME_CHARACTERS = /^[A-Za-z0-9_]+$/;

/** What the user typed, sorted into what the screen should do with it. */
export type SearchQuery =
  /** Nothing typed (or only spaces): show nothing. */
  | {kind: 'empty'}
  /** Can't match any username (a character outside A-Z, 0-9, _ or too long): no results, no search. */
  | {kind: 'invalid'}
  /** Ready to search, from 1 character up. `query` is trimmed and lowercase. */
  | {kind: 'ok'; query: string};

/** Trims what the user typed and decides whether it can be searched. */
export function parseSearchQuery(raw: string): SearchQuery {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {kind: 'empty'};
  }
  if (!USERNAME_CHARACTERS.test(trimmed) || trimmed.length > MAX_USERNAME_LENGTH) {
    return {kind: 'invalid'};
  }
  return {kind: 'ok', query: trimmed.toLowerCase()};
}

/**
 * True if `username` starts with `query`, ignoring capitalization
 * ("joh" matches "Johnny_N"). `query` should come from parseSearchQuery.
 */
export function usernameMatches(username: string, query: string): boolean {
  return username.toLowerCase().startsWith(query.toLowerCase());
}
