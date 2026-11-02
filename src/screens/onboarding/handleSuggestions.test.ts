import {USERNAME_PATTERN} from '../../services/profile';
import {findFreeHandle, getHandleCandidates} from './handleSuggestions';

describe('getHandleCandidates', () => {
  it('suggests endings on the handle, best first', () => {
    expect(getHandleCandidates('hooper').slice(0, 3)).toEqual([
      'hooper_1',
      'hooper2',
      'hooper_sea',
    ]);
  });

  it('only returns handles that follow the username rule', () => {
    for (const handle of ['hooper', 'abc', 'a'.repeat(16), 'Big_Mike_23']) {
      for (const candidate of getHandleCandidates(handle)) {
        expect(candidate).toMatch(USERNAME_PATTERN);
      }
    }
  });

  it('shortens long handles so the ending still fits in 16 characters', () => {
    const candidates = getHandleCandidates('sixteen_chars_xx');
    expect(candidates).toContain('sixteen_chars__1');
    expect(candidates).toContain('sixteen_ch_hoops');
    candidates.forEach((candidate) => expect(candidate.length).toBeLessThanOrEqual(16));
  });

  it('never suggests the handle itself or the same name twice, ignoring case', () => {
    const candidates = getHandleCandidates('Hooper');
    const lower = candidates.map((candidate) => candidate.toLowerCase());
    expect(lower).not.toContain('hooper');
    expect(new Set(lower).size).toBe(candidates.length);
  });

  it('drops characters the rule does not allow', () => {
    expect(getHandleCandidates('big-mike!')[0]).toBe('bigmike_1');
  });

  it('returns nothing when no allowed characters are left', () => {
    expect(getHandleCandidates('')).toEqual([]);
    expect(getHandleCandidates('!!!')).toEqual([]);
  });
});

describe('findFreeHandle', () => {
  /** A fake batch check: everything is free except the names listed. */
  function freeExcept(taken: string[]) {
    const lower = taken.map((name) => name.toLowerCase());
    return jest.fn(async (handles: string[]) =>
      handles.filter((handle) => !lower.includes(handle.toLowerCase())),
    );
  }

  it('checks all candidates in a single call', async () => {
    const getAvailable = freeExcept(['hooper']);
    await expect(findFreeHandle('hooper', getAvailable)).resolves.toBe('hooper_1');
    expect(getAvailable).toHaveBeenCalledTimes(1);
    expect(getAvailable.mock.calls[0][0]).toEqual(getHandleCandidates('hooper'));
  });

  it('skips candidates that are already taken, still in one call', async () => {
    const getAvailable = freeExcept(['hooper_1', 'Hooper2']);
    await expect(findFreeHandle('hooper', getAvailable)).resolves.toBe('hooper_sea');
    expect(getAvailable).toHaveBeenCalledTimes(1);
  });

  it('only ever returns a handle the check said is free', async () => {
    const getAvailable = freeExcept(['hooper_1', 'hooper2']);
    const suggestion = await findFreeHandle('hooper', getAvailable);
    expect(suggestion).not.toBeNull();
    await expect(getAvailable([suggestion!])).resolves.toEqual([suggestion]);
  });

  it('keeps best-first order even if the answer comes back shuffled', async () => {
    const getAvailable = jest.fn(async (handles: string[]) => [...handles].reverse());
    await expect(findFreeHandle('hooper', getAvailable)).resolves.toBe('hooper_1');
  });

  it('never asks about or returns handles in the exclude list', async () => {
    const getAvailable = freeExcept([]);
    await expect(
      findFreeHandle('hooper', getAvailable, ['HOOPER_1']),
    ).resolves.toBe('hooper2');
    expect(getAvailable.mock.calls[0][0]).not.toContain('hooper_1');
  });

  it('returns null when every candidate is taken', async () => {
    const getAvailable = jest.fn(async () => []);
    await expect(findFreeHandle('hooper', getAvailable)).resolves.toBeNull();
  });

  it('returns null (no suggestion) when the check fails', async () => {
    const getAvailable = jest.fn(async () => {
      throw new Error('network down');
    });
    await expect(findFreeHandle('hooper', getAvailable)).resolves.toBeNull();
  });
});
