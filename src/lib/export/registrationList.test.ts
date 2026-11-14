import { describe, it, expect } from 'vitest';
import type { MeetingKind } from '../domain/types';
import type { PlanEntry, VerifyStatus } from '../domain/plan';
import { createTranslator } from '../i18n/t';
import {
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { formatRegistrationList } from './registrationList';

interface EntryInput {
  teachTableId: string;
  subjectId: string;
  section: string;
  kind?: MeetingKind;
  nameTh?: string;
  nameEn?: string;
  verifyStatus?: VerifyStatus;
}

function entry(input: EntryInput): PlanEntry {
  const section = makeSection({
    teachTableId: input.teachTableId,
    subjectId: input.subjectId,
    section: input.section,
    kind: input.kind ?? 'lecture',
    meetings: [],
  });
  return makePlanEntry({
    snapshot: makeSnapshot({
      ...section,
      subjectMeta: {
        subjectId: input.subjectId,
        nameTh: input.nameTh ?? 'การเขียนโปรแกรมคอมพิวเตอร์',
        nameEn: input.nameEn ?? 'Computer Programming',
        credit: 3,
        creditStr: '3(2-2-5)',
      },
    }),
    verifyStatus: input.verifyStatus ?? 'verified',
  });
}

// A lecture and practice pair, entered practice first so the order is the
// formatter's own, and a standalone lecture of a lower subject id.
const plan: PlanEntry[] = [
  entry({
    teachTableId: '135274',
    subjectId: '01076103',
    section: '102',
    kind: 'practice',
  }),
  entry({ teachTableId: '135273', subjectId: '01076103', section: '2' }),
  entry({
    teachTableId: '135224',
    subjectId: '01006029',
    section: '901',
    nameTh: 'สังคมไทยในวันนี้',
    nameEn: "TODAY'S THAI SOCIETY",
  }),
];

describe('formatRegistrationList', () => {
  it('writes one Thai line per subject with both halves of a pair', () => {
    expect(formatRegistrationList(plan, 'th', createTranslator('th'))).toBe(
      [
        '01006029 สังคมไทยในวันนี้ (กลุ่มเรียน ทฤษฎี 901)',
        '01076103 การเขียนโปรแกรมคอมพิวเตอร์ (กลุ่มเรียน ทฤษฎี 2, ปฏิบัติ 102)',
      ].join('\n'),
    );
  });

  it('names the subject in English for the English locale', () => {
    expect(formatRegistrationList(plan, 'en', createTranslator('en'))).toBe(
      [
        "01006029 TODAY'S THAI SOCIETY (Section Lecture 901)",
        '01076103 Computer Programming (Section Lecture 2, Practice 102)',
      ].join('\n'),
    );
  });

  it('falls back to the other name when the locale name is empty', () => {
    const lines = formatRegistrationList(
      [
        entry({
          teachTableId: 'a',
          subjectId: '90000001',
          section: '1',
          nameEn: '',
        }),
      ],
      'en',
      createTranslator('en'),
    );
    expect(lines).toBe(
      '90000001 การเขียนโปรแกรมคอมพิวเตอร์ (Section Lecture 1)',
    );
  });

  it('marks a subject with a section upstream no longer lists', () => {
    const lines = formatRegistrationList(
      [
        entry({
          teachTableId: 'm',
          subjectId: '90592033',
          section: '902',
          verifyStatus: 'missing',
        }),
      ],
      'th',
      createTranslator('th'),
    );
    expect(lines).toBe(
      '90592033 การเขียนโปรแกรมคอมพิวเตอร์ (กลุ่มเรียน ทฤษฎี 902) (ไม่พบ)',
    );
  });

  it('is empty for an empty plan', () => {
    expect(formatRegistrationList([], 'th', createTranslator('th'))).toBe('');
  });
});
