// The projection the read only observer makes of the pre registration page (ADR-0077).
// It holds course facts only: subject ids, section codes and their curriculum suffix,
// lecture or practice, the card status, the credits, the stepper step, the page term,
// and dialogs and toasts as a kind with a planned subject id. It has no free text field,
// so a server message or the student's identity has no place to land. Every projection
// passes this schema before it reaches state, and it is held in memory only.

import { z } from 'zod';

const subjectId = z.string().regex(/^\d{8}$/);
const section = z.string().regex(/^\d{1,4}$/);
const kind = z.enum(['lecture', 'practice']).nullable();
const curriculum = z.string().min(1).max(60).nullable();
const credit = z.number().int().min(0).max(99).nullable();

const listRowSchema = z.strictObject({ subjectId, section, kind, curriculum });
const selectionSchema = z.strictObject({ section, curriculum });

const CARD_STATUSES = [
  'empty',
  'typing',
  'searching',
  'offered',
  'refused',
  'alreadyListed',
  'entered',
] as const;

const cardSchema = z.strictObject({
  status: z.enum(CARD_STATUSES),
  /** The field value when it is a planned subject id, else null. */
  subjectId: subjectId.nullable(),
  colour: z.enum(['pending', 'fits', 'clash']),
  primary: selectionSchema.nullable(),
  practice: selectionSchema.nullable(),
  /** Whether the practice row offers its own select, a pair the lecture does not lock. */
  practiceSelect: z.boolean(),
  /** The selected section's seats: a null limit is the host's dash for none set. */
  seats: z
    .strictObject({
      limit: z.number().int().min(0).nullable(),
      count: z.number().int().min(0),
    })
    .nullable(),
});

const dialogSchema = z.strictObject({
  kind: z.enum(['gradeNotAnnounced', 'confirmSubmit', 'timeSlot', 'other']),
  prerequisites: z.array(subjectId).max(20),
});

const toastSchema = z.strictObject({
  kind: z.enum(['alreadyListed', 'clash', 'refused', 'submitted', 'other']),
  /** The planned subject the toast names, else null; the text itself is dropped. */
  subjectId: subjectId.nullable(),
});

const resultSchema = z.strictObject({
  subjectId,
  section,
  kind,
  curriculum,
  result: z.enum(['waiting', 'granted', 'notGranted', 'notGrantedCondition']),
});

export const hostObservationSchema = z.strictObject({
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  term: z
    .strictObject({
      year: z.string().regex(/^\d{4}$/),
      semester: z.enum(['1', '2', '3']),
    })
    .nullable(),
  card: cardSchema.nullable(),
  /** The host list on the choose subjects step, or null on any other step. */
  list: z.array(listRowSchema).max(40).nullable(),
  credits: z
    .strictObject({ total: credit, min: credit, max: credit })
    .nullable(),
  dialog: dialogSchema.nullable(),
  toasts: z.array(toastSchema).max(50),
  /** The result table on the complete step, or null on any other step. */
  results: z.array(resultSchema).max(40).nullable(),
});

export type HostObservation = z.infer<typeof hostObservationSchema>;
