/**
 * Colors from the Figma file (MOTION — UI DEMO).
 * Each name matches a Figma variable, e.g. `yellow` is `motion-color-yellow`.
 */
export const colors = {
  /** Screen background. Figma: motion-color-bg */
  bg: '#0D0D0D',
  /** Input and secondary button fill. Figma: motion-color-panel */
  panel: '#1C1C1C',
  /** Main text. Figma: motion-color-text */
  text: '#F2F2F0',
  /** Secondary text and placeholders. Figma: motion-color-muted */
  muted: '#B0B0AD',
  /** Brand color: logo, primary button, step labels. Figma: motion-color-yellow */
  yellow: '#F9EC4A',
  /** Outline of inputs and secondary buttons. Figma: motion-control-border */
  controlBorder: '#777777',
  /**
   * Error messages. TEMPORARY: not in Figma. Picked to be readable on the
   * black background until Reed chooses an error color.
   */
  error: '#FF6B6B',
} as const;

/**
 * How faded a control looks. Not in Figma (the design shows no pressed or
 * disabled states), so these are our own choices.
 */
export const opacity = {
  pressed: 0.7,
  disabled: 0.4,
} as const;
