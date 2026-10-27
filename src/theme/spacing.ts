/**
 * Spacing, corner radius, and fixed sizes from the Figma file.
 * Values marked "not a variable" were typed directly in Figma.
 */
export const spacing = {
  /** Figma: motion-space-0 */
  none: 0,
  /** Gap between sign-up fields. Figma: motion-space-4 */
  xs: 4,
  /** Gap inside a field (label to input). Figma: motion-space-8 */
  sm: 8,
  /** Padding inside inputs and buttons. Figma: motion-space-12 */
  md: 12,
  /** Gap between items on the Log in screen (not a variable). */
  lg: 16,
  /** Left/right screen margin (not a variable). */
  screen: 20,
} as const;

export const radius = {
  /** Square corners everywhere. Figma: motion-radius-none */
  none: 0,
} as const;

export const sizes = {
  /**
   * Height of inputs and buttons (Figma component notes: "48px"). Used as a
   * minimum so they grow when the user picks a larger iPhone text size.
   */
  control: 48,
  /**
   * Widest the auth content gets, so the form doesn't stretch across an iPad
   * (not in Figma; the designs are phone-only). Phones are narrower than this.
   */
  maxContentWidth: 480,
  /** Tap area of the header back button (Figma: 44 x 44). */
  touchTarget: 44,
  /** Header back icon (Figma: 24 x 24). */
  icon: 24,
  /** Input and button border width. */
  border: 1,
  /** Line thickness of icons (Figma back icon: 1.8). */
  iconStroke: 1.8,
  /** Height of the top bar with the back button (Figma: 58). */
  header: 58,
} as const;
