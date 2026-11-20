// The poster display options. They control how the preview and every export
// render, so the same object drives the on screen poster, the PNG capture, and
// the plain text export, which keeps what the user sees identical to what they
// share. showRoom, showSection, and showSubjectId toggle those fields on blocks, the
// shelf, and the text export, and nameLanguage names every subject in Thai, English, or
// both (nameLanguage.ts). All toggles default on except showSubjectId, which is off so a
// poster reads clean and the numeric id stays recoverable from the text export; the edit
// grid ignores it and always shows the id for cross referencing. nameLanguage defaults
// unset, which follows the panel language.
// showExams adds the plan's exam schedule below the poster grid and to the text
// export; it is off so a poster stays a class timetable unless asked (ADR-0064).
// Two retired fields are no field here: fit to content (ADR-0043) and show English names,
// which the name language replaced (ADR-0046 amendment of 2026-11-20). The object schema
// strips unknown keys, so a stored blob that still carries either parses without it.

import { z } from 'zod';
import { NAME_LANGUAGES } from './nameLanguage';

export const displayOptionsSchema = z.object({
  showRoom: z.boolean(),
  showSection: z.boolean(),
  // Defaulted so a preferences blob written before this field existed still validates
  // and reads the field off, no schema version bump (matching the exportTemplate field).
  showSubjectId: z.boolean().default(false),
  // Defaulted for the same reason, so an older blob reads the exam schedule off.
  showExams: z.boolean().default(false),
  // Optional, so an older blob reads as following the panel language; a value this build
  // does not know, from a newer build, reads as absent rather than failing the blob.
  nameLanguage: z.enum(NAME_LANGUAGES).optional().catch(undefined),
});

export type DisplayOptions = z.infer<typeof displayOptionsSchema>;

/** The on and off display options, every field but the name language. */
export type DisplayToggle = Exclude<keyof DisplayOptions, 'nameLanguage'>;

/** Preview defaults: every field shown except the subject id and the exam schedule, and
 * names in the panel language. */
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showRoom: true,
  showSection: true,
  showSubjectId: false,
  showExams: false,
};
