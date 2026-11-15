// The poster display options. They control how the preview and every export
// render, so the same object drives the on screen poster, the PNG capture, and
// the plain text export, which keeps what the user sees identical to what they
// share. showRoom, showSection, showEnglishNames, and showSubjectId toggle those
// fields on blocks, the shelf, and the text export. All default on except
// showSubjectId, which is off so a poster reads clean and the numeric id stays
// recoverable from the text export; the edit grid ignores it and always shows the
// id for cross referencing.
// showExams adds the plan's exam schedule below the poster grid and to the text
// export; it is off so a poster stays a class timetable unless asked (ADR-0064).
// The retired fit to content flag (ADR-0043) is no field here: the object schema strips
// unknown keys, so a stored blob that still carries it parses without it.

import { z } from 'zod';

export const displayOptionsSchema = z.object({
  showRoom: z.boolean(),
  showSection: z.boolean(),
  showEnglishNames: z.boolean(),
  // Defaulted so a preferences blob written before this field existed still validates
  // and reads the field off, no schema version bump (matching the exportTemplate field).
  showSubjectId: z.boolean().default(false),
  // Defaulted for the same reason, so an older blob reads the exam schedule off.
  showExams: z.boolean().default(false),
});

export type DisplayOptions = z.infer<typeof displayOptionsSchema>;

/** Preview defaults: every field shown except the subject id and the exam schedule. */
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showRoom: true,
  showSection: true,
  showEnglishNames: true,
  showSubjectId: false,
  showExams: false,
};
