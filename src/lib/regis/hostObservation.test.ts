import { describe, expect, it } from 'vitest';
import { hostObservationSchema, type HostObservation } from './hostObservation';

// The projection is the privacy boundary of the observer (ADR-0077): course facts only,
// with no place for free text, so a server message or the student's identity cannot
// land in it even if the reader tried to put it there.

const VALID: HostObservation = {
  step: 2,
  term: { year: '2569', semester: '2' },
  card: {
    status: 'offered',
    subjectId: '01476107',
    colour: 'fits',
    primary: { section: '1', curriculum: 'CE' },
    practice: { section: '101', curriculum: null },
  },
  list: [
    { subjectId: '01476106', section: '2', kind: 'lecture', curriculum: null },
  ],
  credits: { total: 3, min: 9, max: 22 },
  dialog: { kind: 'gradeNotAnnounced', prerequisites: ['01476105'] },
  toasts: [{ kind: 'refused', subjectId: '01476107' }],
  results: null,
};

describe('hostObservationSchema', () => {
  it('accepts a projection of course facts', () => {
    expect(hostObservationSchema.parse(VALID)).toEqual(VALID);
  });

  it.each<[string, unknown]>([
    [
      'a toast that keeps its text',
      { ...VALID, toasts: [{ kind: 'refused', subjectId: null, text: 'x' }] },
    ],
    [
      'a dialog that keeps its text',
      { ...VALID, dialog: { kind: 'other', prerequisites: [], title: 'x' } },
    ],
    ['a header field', { ...VALID, studentId: '65010001' }],
    [
      'a subject id that is not 8 digits',
      { ...VALID, toasts: [{ kind: 'other', subjectId: '6501' }] },
    ],
    [
      'a section that is not a code',
      {
        ...VALID,
        list: [
          { subjectId: '01476106', section: 'A', kind: null, curriculum: null },
        ],
      },
    ],
    [
      'a curriculum longer than a name',
      {
        ...VALID,
        list: [
          {
            subjectId: '01476106',
            section: '2',
            kind: null,
            curriculum: 'x'.repeat(61),
          },
        ],
      },
    ],
    [
      'an unknown card status',
      { ...VALID, card: { ...VALID.card, status: 'submitted' } },
    ],
  ])('rejects %s', (_name, value) => {
    expect(hostObservationSchema.safeParse(value).success).toBe(false);
  });
});
