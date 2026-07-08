// The plan model and its Zod schema. The grid renders exclusively from plan
// snapshots, so a plan carries a full section snapshot per entry rather than a
// reference into the transient catalog. subjectId plus section is the durable
// identity of an entry; teachTableId is the fast lookup key. sourceQuery records
// the exact query that produced the section so revalidation can replay it.
//
// Types are inferred from the schemas, which validate imported plan JSON and
// stored plans at the trust boundary.

import { z } from 'zod';
import type { DayOfWeek } from '../parsing/days';
import type { Exam, Section } from './types';

const dayOfWeekSchema: z.ZodType<DayOfWeek> = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const meetingSchema = z.object({
  day: dayOfWeekSchema,
  startMin: z.number(),
  endMin: z.number(),
  room: z.string(),
  building: z.string(),
  kind: z.enum(['lecture', 'practice']),
});

const dateRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const seatsSchema = z.object({
  limit: z.number().nullable(),
  preCount: z.number(),
  queueLeft: z.number(),
  enrolled: z.union([z.number(), z.literal('full')]),
});

const examSchema = z.object({
  midterm: dateRangeSchema.optional(),
  final: dateRangeSchema.optional(),
  note: z.string().optional(),
});

// A section snapshot is a normalized Section plus the minimal subject metadata the
// grid needs to render it without the catalog.
export const sectionSnapshotSchema = z.object({
  teachTableId: z.string(),
  subjectId: z.string(),
  section: z.string(),
  kind: z.enum(['lecture', 'practice']),
  pairedSection: z.string().nullable(),
  meetings: z.array(meetingSchema),
  teachersTh: z.array(z.string()),
  teachersEn: z.array(z.string()),
  seats: seatsSchema,
  isClosed: z.boolean(),
  exam: examSchema,
  rulesTh: z.string(),
  rulesEn: z.string(),
  remark: z.string(),
  subjectMeta: z.object({
    subjectId: z.string(),
    nameTh: z.string(),
    nameEn: z.string(),
    credit: z.number(),
    creditStr: z.string(),
  }),
});

export const verifyStatusSchema = z.enum([
  'unverified',
  'verified',
  'changed',
  'missing',
]);

export const sourceQuerySchema = z.object({
  endpoint: z.literal('get-teach-table-show'),
  params: z.record(z.string(), z.string()),
});

export const planEntrySchema = z.object({
  teachTableId: z.string(),
  subjectId: z.string(),
  section: z.string(),
  addedAt: z.string(),
  lastVerifiedAt: z.string().nullable(),
  verifyStatus: verifyStatusSchema,
  sourceQuery: sourceQuerySchema,
  snapshot: sectionSnapshotSchema,
});

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  year: z.string(),
  semester: z.enum(['1', '2', '3']),
  entries: z.array(planEntrySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type VerifyStatus = z.infer<typeof verifyStatusSchema>;
export type SourceQuery = z.infer<typeof sourceQuerySchema>;
export type SectionSnapshot = z.infer<typeof sectionSnapshotSchema>;
export type PlanEntry = z.infer<typeof planEntrySchema>;
export type Plan = z.infer<typeof planSchema>;

/**
 * Convert a stored snapshot into a plain domain Section for the planner. The
 * snapshot exam infers its optional fields as `T | undefined` from the schema, so
 * the exam is rebuilt with only the present fields to satisfy the stricter domain
 * Exam under exactOptionalPropertyTypes. Every other field maps across directly.
 */
export function snapshotToSection(snapshot: SectionSnapshot): Section {
  const exam: Exam = {};
  if (snapshot.exam.midterm !== undefined) {
    exam.midterm = snapshot.exam.midterm;
  }
  if (snapshot.exam.final !== undefined) {
    exam.final = snapshot.exam.final;
  }
  if (snapshot.exam.note !== undefined) {
    exam.note = snapshot.exam.note;
  }
  return {
    teachTableId: snapshot.teachTableId,
    subjectId: snapshot.subjectId,
    section: snapshot.section,
    kind: snapshot.kind,
    pairedSection: snapshot.pairedSection,
    meetings: snapshot.meetings,
    teachersTh: snapshot.teachersTh,
    teachersEn: snapshot.teachersEn,
    seats: snapshot.seats,
    isClosed: snapshot.isClosed,
    exam,
    rulesTh: snapshot.rulesTh,
    rulesEn: snapshot.rulesEn,
    remark: snapshot.remark,
  };
}
