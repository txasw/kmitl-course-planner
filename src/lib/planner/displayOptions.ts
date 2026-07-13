// The poster display options. They control how the preview and every export
// render, so the same object drives the on screen poster, the PNG capture, and
// the plain text export, which keeps what the user sees identical to what they
// share. fitToContent trims the grid to the hours and days the plan uses;
// showRoom, showSection, showEnglishNames, and showSubjectId toggle those fields on
// blocks, the shelf, and the text export. All default on except showSubjectId, which
// is off so a poster reads clean and the numeric id stays recoverable from the text
// export; the edit grid ignores it and always shows the id for cross referencing.

import { z } from 'zod';

export const displayOptionsSchema = z.object({
  fitToContent: z.boolean(),
  showRoom: z.boolean(),
  showSection: z.boolean(),
  showEnglishNames: z.boolean(),
  // Defaulted so a preferences blob written before this field existed still validates
  // and reads the field off, no schema version bump (matching the exportTemplate field).
  showSubjectId: z.boolean().default(false),
});

export type DisplayOptions = z.infer<typeof displayOptionsSchema>;

/** Preview defaults: every field shown except the subject id, which is off. */
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  fitToContent: true,
  showRoom: true,
  showSection: true,
  showEnglishNames: true,
  showSubjectId: false,
};
