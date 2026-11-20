// The props of the 14 px glyph that leads a fact or a quiet status in a dense row. The glyph
// is decoration beside its words, so it stays hidden from assistive technology.

export const SMALL_ICON = {
  size: 14,
  strokeWidth: 2,
  'aria-hidden': true,
} as const;
