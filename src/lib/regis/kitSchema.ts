// The registration kit as stored: per planned subject, every section the public data
// listed for it at a calm time, so the companion on the registration pages can show the
// planned section, its times, and the other sections without a request of its own.
// Sections keep the plan snapshot shape, so a backup picked on registration day saves
// to the plan through the same transaction as any add. Every field is public course
// data from the public teach table endpoint; nothing here comes from the host page.

import { z } from 'zod';
import { sectionSnapshotSchema, sourceQuerySchema } from '../domain/plan';

/** How a section group sits against the rest of the plan at prepare time. */
export const KIT_FITS = ['fits', 'time', 'exam'] as const;
export type KitFit = (typeof KIT_FITS)[number];

/** The seat state of a section group at prepare time, its worst member deciding. */
export const KIT_SEATS = ['open', 'full', 'closed'] as const;
export type KitSeat = (typeof KIT_SEATS)[number];

/** One section group of a subject: a single section, or a lecture with its pair. */
export const kitOptionSchema = z.object({
  /** The group's teach table ids, in section code order. */
  ids: z.array(z.string()).min(1),
  /** Whether this is the group the plan holds. */
  planned: z.boolean(),
  fit: z.enum(KIT_FITS),
  seat: z.enum(KIT_SEATS),
  /**
   * Whether a member was offered to the student's own curriculum, or null when the
   * plan does not say which curriculum that is.
   */
  ownCurriculum: z.boolean().nullable(),
});
export type KitOption = z.infer<typeof kitOptionSchema>;

export const kitSubjectSchema = z.object({
  subjectId: z.string(),
  nameTh: z.string(),
  nameEn: z.string(),
  credit: z.number(),
  creditStr: z.string(),
  /** The by subject id query the sections came from, stamped on a saved backup. */
  sourceQuery: sourceQuerySchema,
  sections: z.array(sectionSnapshotSchema),
  /** The planned group's ids in the fresh data; empty when it was not listed. */
  plannedIds: z.array(z.string()),
  options: z.array(kitOptionSchema),
  /** Section codes listed more than once for one kind, each under its curriculum. */
  duplicateCodes: z.array(z.string()),
});
export type KitSubject = z.infer<typeof kitSubjectSchema>;

export const registrationKitSchema = z.object({
  planId: z.string(),
  year: z.string(),
  semester: z.enum(['1', '2', '3']),
  preparedAt: z.iso.datetime(),
  subjects: z.array(kitSubjectSchema),
  /** Planned subjects whose read failed, so the kit says nothing new about them. */
  unread: z.array(z.string()),
});
export type RegistrationKit = z.infer<typeof registrationKitSchema>;
