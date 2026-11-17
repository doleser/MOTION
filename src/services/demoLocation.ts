/**
 * Prototype Controls (Figma: OVERLAY / Demo tools): a fake location reading
 * for check-in, so testers can try every outcome without walking to a court.
 *
 * Only used when DEMO_TOOLS_ENABLED (development builds and Expo Go). Release
 * builds never read the override, so the server's 150 m rule always uses the
 * real reading there.
 */

/** What the next check-in reading should pretend to be. */
export type DemoLocation = 'at_court' | 'too_far' | 'denied' | 'unavailable';

/** Prototype Controls are shown and honored only in development. */
export const DEMO_TOOLS_ENABLED = __DEV__;

let override: DemoLocation | null = null;

/** The active override, or null to use the real GPS reading. */
export function getDemoLocation(): DemoLocation | null {
  return DEMO_TOOLS_ENABLED ? override : null;
}

export function setDemoLocation(next: DemoLocation | null): void {
  override = next;
}
