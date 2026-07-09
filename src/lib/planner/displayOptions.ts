// The poster display options. They control how the preview and every export
// render, so the same object drives the on screen poster, the PNG capture, and
// the plain text export, which keeps what the user sees identical to what they
// share. fitToContent trims the grid to the hours and days the plan uses;
// showRoom, showSection, and showEnglishNames toggle those fields on blocks, the
// shelf, and the text export. All default on, matching the preview defaults.

import { z } from 'zod';

export const displayOptionsSchema = z.object({
  fitToContent: z.boolean(),
  showRoom: z.boolean(),
  showSection: z.boolean(),
  showEnglishNames: z.boolean(),
});

export type DisplayOptions = z.infer<typeof displayOptionsSchema>;

/** Preview defaults: fit to content on and every field shown. */
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  fitToContent: true,
  showRoom: true,
  showSection: true,
  showEnglishNames: true,
};
