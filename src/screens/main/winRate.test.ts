import {formatWinRate, getWinRate} from './winRate';

describe('getWinRate', () => {
  it('works out a normal record', () => {
    expect(getWinRate({wins: 26, losses: 14})).toBe(65);
    expect(getWinRate({wins: 3, losses: 1})).toBe(75);
  });

  it('returns null with no games, instead of dividing by zero', () => {
    expect(getWinRate({wins: 0, losses: 0})).toBeNull();
  });

  it('is 100 with all wins', () => {
    expect(getWinRate({wins: 5, losses: 0})).toBe(100);
  });

  it('is 0 with all losses', () => {
    expect(getWinRate({wins: 0, losses: 4})).toBe(0);
  });

  it('rounds to the nearest whole percent', () => {
    expect(getWinRate({wins: 2, losses: 1})).toBe(67); // 66.67
    expect(getWinRate({wins: 1, losses: 2})).toBe(33); // 33.33
    expect(getWinRate({wins: 1, losses: 6})).toBe(14); // 14.29
  });

  it('rounds exact halves up', () => {
    expect(getWinRate({wins: 1, losses: 7})).toBe(13); // 12.5
    expect(getWinRate({wins: 29, losses: 171})).toBe(15); // 14.5
  });
});

describe('formatWinRate', () => {
  it('adds a percent sign', () => {
    expect(formatWinRate({wins: 26, losses: 14})).toBe('65%');
  });

  it('shows a dash with no games', () => {
    expect(formatWinRate({wins: 0, losses: 0})).toBe('—');
  });
});
