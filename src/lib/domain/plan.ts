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

// Grouping membership as ids only, so a dense plan stays small in storage.local; names
// resolve at render from the reference lists (ADR-0061).
const offeredToSchema = z.object({
  facultyId: z.string(),
  departmentId: z.string(),
  curriculumId: z.string(),
  classYear: z.string(),
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
  // Optional so a plan stored or exported before the field existed still parses. It is
  // scoped to the query that produced the section, so revalidation refreshes it without
  // ever diffing it.
  offeredTo: z.array(offeredToSchema).optional(),
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

/**
 * Whether an entry's source query targets the plan's term. The comparison is on the
 * raw params with no defaulting, so an entry whose query lacks a year or semester
 * matches no plan. The plan schema and revalidation share this one check.
 */
export function entryTermMatches(
  entry: { sourceQuery: { params: Record<string, string> } },
  plan: { year: string; semester: string },
): boolean {
  return (
    entry.sourceQuery.params.selected_year === plan.year &&
    entry.sourceQuery.params.selected_semester === plan.semester
  );
}

// A plan belongs to exactly one year and semester pair, and every entry must come
// from a query for that same term. The refine asserts that invariant, so a mixed
// term blob is rejected at every trust boundary that parses a plan, including a
// storage read and a future JSON import.
export const planSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    year: z.string(),
    semester: z.enum(['1', '2', '3']),
    entries: z.array(planEntrySchema),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((plan, ctx) => {
    plan.entries.forEach((entry, index) => {
      if (!entryTermMatches(entry, plan)) {
        ctx.addIssue({
          code: 'custom',
          message: 'plan entry term does not match the plan term',
          path: ['entries', index, 'sourceQuery'],
        });
      }
    });
  });

export type VerifyStatus = z.infer<typeof verifyStatusSchema>;
export type SourceQuery = z.infer<typeof sourceQuerySchema>;
export type SectionSnapshot = z.infer<typeof sectionSnapshotSchema>;
export type PlanEntry = z.infer<typeof planEntrySchema>;
export type Plan = z.infer<typeof planSchema>;

type SubjectMeta = SectionSnapshot['subjectMeta'];

/**
 * Build a section snapshot from a normalized section and its subject metadata. Used
 * when an entry is added and again when revalidation reconciles an entry to fresh
 * data, so the two never build the snapshot shape differently. It returns a new top
 * level object referencing the section's fields, so reconcile replaces an entry's
 * snapshot rather than mutating the old one; snapshots are treated as immutable, since
 * the nested arrays and objects are shared by reference.
 */
export function buildSnapshot(
  section: Section,
  subjectMeta: SubjectMeta,
): SectionSnapshot {
  const snapshot: SectionSnapshot = {
    teachTableId: section.teachTableId,
    subjectId: section.subjectId,
    section: section.section,
    kind: section.kind,
    pairedSection: section.pairedSection,
    meetings: section.meetings,
    teachersTh: section.teachersTh,
    teachersEn: section.teachersEn,
    seats: section.seats,
    isClosed: section.isClosed,
    exam: section.exam,
    rulesTh: section.rulesTh,
    rulesEn: section.rulesEn,
    remark: section.remark,
    subjectMeta,
  };
  if (section.offeredTo !== undefined) {
    snapshot.offeredTo = section.offeredTo;
  }
  return snapshot;
}

/**
 * Convert a stored snapshot into a plain domain Section for the planner. The
 * snapshot exam infers its optional fields as `T | undefined` from the schema, so
 * the exam is rebuilt with only the present fields to satisfy the stricter domain
 * Exam under exactOptionalPropertyTypes, and offeredTo is set only when the snapshot
 * carries it. Every other field maps across directly.
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
  const section: Section = {
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
  if (snapshot.offeredTo !== undefined) {
    section.offeredTo = snapshot.offeredTo;
  }
  return section;
}
