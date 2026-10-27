/**
 * Text styles from the Figma file. Each one matches a Figma text style,
 * e.g. `title` is "MOTION / title".
 *
 * With custom fonts, React Native picks the weight by font *name*, not by
 * `fontWeight`, so each weight gets its own family name below. These names
 * match the @expo-google-fonts packages, which aren't installed yet. Until
 * they're loaded, the phone falls back to its system font.
 */
export const fonts = {
  /** Anton Regular: big condensed headings. */
  anton: 'Anton_400Regular',
  /** Inter at each weight the designs use. */
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const;

export const typography = {
  /**
   * "MOTION" logo. Figma: MOTION / display (Anton 52/60).
   * No lineHeight on purpose: Figma's 60 is shorter than Anton needs (~78),
   * and iOS cuts the extra off the top of the letters. The logo is one line,
   * so the font's natural height is fine.
   */
  display: {fontFamily: fonts.anton, fontSize: 52},
  /** Screen headline, e.g. "BACK ON THE COURT". Figma: MOTION / title (Anton 32/40) */
  title: {fontFamily: fonts.anton, fontSize: 32, lineHeight: 40},
  /** Field labels and small caps lines. Figma: MOTION / label (Inter Bold 12/16) */
  label: {fontFamily: fonts.interBold, fontSize: 12, lineHeight: 16},
  /** Paragraphs and input text. Figma: MOTION / body (Inter Regular 14/20) */
  body: {fontFamily: fonts.interRegular, fontSize: 14, lineHeight: 20},
  /** Button labels and header title. Figma: MOTION / ui (Inter SemiBold 14/20) */
  ui: {fontFamily: fonts.interSemiBold, fontSize: 14, lineHeight: 20},
  /** Helper text under fields, footnotes. Figma: MOTION / meta (Inter Medium 11/16) */
  meta: {fontFamily: fonts.interMedium, fontSize: 11, lineHeight: 16},
} as const;
