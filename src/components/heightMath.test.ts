import {
  clampHeight,
  cmToInches,
  formatHeight,
  inchesToCm,
  splitHeight,
} from './heightMath';

const RANGE = {min: 54, max: 90}; // 4'6" to 7'6"

describe('splitHeight / formatHeight', () => {
  it('splits total inches into feet and inches', () => {
    expect(splitHeight(74)).toEqual({feet: 6, inches: 2});
    expect(splitHeight(72)).toEqual({feet: 6, inches: 0});
  });

  it('formats with foot and inch marks', () => {
    expect(formatHeight(74)).toBe('6′ 2″');
    expect(formatHeight(54)).toBe('4′ 6″');
  });
});

describe('clampHeight', () => {
  it('rounds to a whole inch inside the range', () => {
    expect(clampHeight(73.6, RANGE)).toBe(74);
    expect(clampHeight(40, RANGE)).toBe(54);
    expect(clampHeight(95, RANGE)).toBe(90);
  });
});

describe('inchesToCm / cmToInches', () => {
  it('converts both ways and round-trips every height in range', () => {
    expect(inchesToCm(74)).toBe(188);
    for (let inches = RANGE.min; inches <= RANGE.max; inches++) {
      expect(cmToInches(inchesToCm(inches))).toBe(inches);
    }
  });
});
