/**
 * Height helpers, as plain functions (no UI) so they can be tested.
 * Heights are whole inches in total, e.g. 6'2" is 74.
 */

export interface HeightRange {
  /** Lowest allowed height, in total inches. */
  min: number;
  /** Highest allowed height, in total inches. */
  max: number;
}

const INCHES_PER_FOOT = 12;
const CM_PER_INCH = 2.54;

/** 74 -> {feet: 6, inches: 2} */
export function splitHeight(totalInches: number): {feet: number; inches: number} {
  return {
    feet: Math.floor(totalInches / INCHES_PER_FOOT),
    inches: totalInches % INCHES_PER_FOOT,
  };
}

/** 74 -> "6′ 2″" (with real foot and inch marks). */
export function formatHeight(totalInches: number): string {
  const {feet, inches} = splitHeight(totalInches);
  return `${feet}′ ${inches}″`;
}

/** Rounds to a whole inch and keeps it inside the range. */
export function clampHeight(totalInches: number, range: HeightRange): number {
  return Math.min(range.max, Math.max(range.min, Math.round(totalInches)));
}

/** For saving: 74 inches -> 188 cm (whole centimeters). */
export function inchesToCm(totalInches: number): number {
  return Math.round(totalInches * CM_PER_INCH);
}

/** For showing a saved height: 188 cm -> 74 inches. */
export function cmToInches(cm: number): number {
  return Math.round(cm / CM_PER_INCH);
}
