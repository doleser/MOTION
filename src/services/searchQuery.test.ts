import {parseSearchQuery, usernameMatches} from './searchQuery';

describe('parseSearchQuery', () => {
  it('is empty with nothing typed', () => {
    expect(parseSearchQuery('')).toEqual({kind: 'empty'});
  });

  it('is empty with only spaces', () => {
    expect(parseSearchQuery('   ')).toEqual({kind: 'empty'});
  });

  it('searches from 1 character', () => {
    expect(parseSearchQuery('j')).toEqual({kind: 'ok', query: 'j'});
  });

  it('trims spaces around the query', () => {
    expect(parseSearchQuery('  joh  ')).toEqual({kind: 'ok', query: 'joh'});
  });

  it('lowercases the query', () => {
    expect(parseSearchQuery('JoH')).toEqual({kind: 'ok', query: 'joh'});
  });

  it('allows letters, digits, and underscores', () => {
    expect(parseSearchQuery('mwebb_23')).toEqual({kind: 'ok', query: 'mwebb_23'});
    expect(parseSearchQuery('_')).toEqual({kind: 'ok', query: '_'});
  });

  it('is invalid with a character a username can\'t have', () => {
    expect(parseSearchQuery('@noahk')).toEqual({kind: 'invalid'});
    expect(parseSearchQuery('noah k')).toEqual({kind: 'invalid'});
    expect(parseSearchQuery('noah-k')).toEqual({kind: 'invalid'});
    expect(parseSearchQuery('%')).toEqual({kind: 'invalid'});
  });

  it('is invalid with letters outside A-Z (accents, emoji)', () => {
    expect(parseSearchQuery('josé')).toEqual({kind: 'invalid'});
    expect(parseSearchQuery('jo🏀')).toEqual({kind: 'invalid'});
  });

  it('allows up to 16 characters, the longest a username can be', () => {
    expect(parseSearchQuery('a'.repeat(16))).toEqual({kind: 'ok', query: 'a'.repeat(16)});
    expect(parseSearchQuery('a'.repeat(17))).toEqual({kind: 'invalid'});
  });

  it('counts length after trimming', () => {
    expect(parseSearchQuery(` ${'a'.repeat(16)} `)).toEqual({kind: 'ok', query: 'a'.repeat(16)});
  });
});

describe('usernameMatches', () => {
  it('matches usernames that start with the query', () => {
    expect(usernameMatches('johnny_n', 'joh')).toBe(true);
    expect(usernameMatches('johnny_n', 'johnny_n')).toBe(true);
  });

  it('ignores capitalization on both sides', () => {
    expect(usernameMatches('JohnP', 'joh')).toBe(true);
    expect(usernameMatches('johnny_n', 'JOH')).toBe(true);
  });

  it("doesn't match the query in the middle or end of a username", () => {
    expect(usernameMatches('bigjohn', 'joh')).toBe(false);
    expect(usernameMatches('noahk', 'hk')).toBe(false);
  });

  it("doesn't match a query longer than the username", () => {
    expect(usernameMatches('jo', 'joh')).toBe(false);
  });
});
