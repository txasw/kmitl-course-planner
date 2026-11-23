import { describe, it, expect } from 'vitest';
import type { NormalizedCatalog } from '../domain/normalize';
import type { PlanEntry } from '../domain/plan';
import type { Course, Section } from '../domain/types';
import {
  makeCourse,
  makeMeeting,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { toSnapshot } from '../planner/transaction';
import {
  buildRegistrationKit,
  entryCurriculum,
  isKitFresh,
  KIT_MAX_AGE_MS,
  kitConditions,
  kitMatchesPlan,
  plannedSections,
  refitKit,
  subjectQuery,
  summarizeKit,
} from './kit';
import { registrationKitSchema } from './kitSchema';

const MONDAY_NINE = makeMeeting({ day: 1, startMin: 540, endMin: 660 });
const TUESDAY_NINE = makeMeeting({ day: 2, startMin: 540, endMin: 660 });

function catalogOf(...courses: Course[]): NormalizedCatalog {
  return { courses, duplicateCount: 0, multiMeetingCount: 0, warnings: [] };
}

function entryFor(
  course: Course,
  section: Section,
  params: Record<string, string> = {},
): PlanEntry {
  return makePlanEntry({
    snapshot: toSnapshot(course, section),
    sourceQuery: {
      endpoint: 'get-teach-table-show',
      params: {
        mode: 'by_class',
        selected_year: '2569',
        selected_semester: '1',
        ...params,
      },
    },
  });
}

const A1 = makeSection({
  teachTableId: 'A1',
  subjectId: 'A',
  section: '1',
  meetings: [MONDAY_NINE],
});
const A2 = makeSection({
  teachTableId: 'A2',
  subjectId: 'A',
  section: '2',
  meetings: [TUESDAY_NINE],
});
const A3 = makeSection({
  teachTableId: 'A3',
  subjectId: 'A',
  section: '3',
  meetings: [MONDAY_NINE],
  seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 'full' },
});
const COURSE_A = makeCourse({ subjectId: 'A', sections: [A1, A2, A3] });

const B1 = makeSection({
  teachTableId: 'B1',
  subjectId: 'B',
  section: '1',
  meetings: [TUESDAY_NINE],
});
const COURSE_B = makeCourse({ subjectId: 'B', sections: [B1] });

describe('subjectQuery', () => {
  it('searches one subject across every curriculum', () => {
    expect(subjectQuery({ year: '2569', semester: '2' }, '01476107')).toEqual({
      mode: 'by_subject_id',
      selected_year: '2569',
      selected_semester: '2',
      search_all_faculty: true,
      search_all_department: true,
      search_all_curriculum: true,
      search_all_class_year: true,
      selected_subject_id: '01476107',
    });
  });
});

describe('buildRegistrationKit', () => {
  const plan = makePlan({
    entries: [entryFor(COURSE_A, A1), entryFor(COURSE_B, B1)],
  });
  const kit = buildRegistrationKit({
    plan,
    results: new Map([
      ['A', catalogOf(COURSE_A)],
      ['B', catalogOf(COURSE_B)],
    ]),
    preparedAt: '2026-11-22T14:10:00.000Z',
  });

  it('lists every section of each planned subject and marks the planned one', () => {
    const subject = kit.subjects.find((item) => item.subjectId === 'A');
    expect(subject?.sections.map((section) => section.teachTableId)).toEqual([
      'A1',
      'A2',
      'A3',
    ]);
    expect(subject?.plannedIds).toEqual(['A1']);
    expect(subject?.options.find((option) => option.planned)?.ids).toEqual([
      'A1',
    ]);
  });

  it('checks each other section against the rest of the plan', () => {
    const subject = kit.subjects.find((item) => item.subjectId === 'A');
    const byId = new Map(
      subject?.options.map((option) => [option.ids[0], option]),
    );
    // A2 meets on Tuesday morning, where B already sits.
    expect(byId.get('A2')?.fit).toBe('time');
    // A3 meets on Monday, free once A1 leaves, but it was full.
    expect(byId.get('A3')?.fit).toBe('fits');
    expect(byId.get('A3')?.seat).toBe('full');
  });

  it('carries the term and validates as stored', () => {
    expect(kit.year).toBe('2569');
    expect(kit.semester).toBe('1');
    expect(registrationKitSchema.safeParse(kit).success).toBe(true);
  });

  it('stamps a by subject id source query on each subject', () => {
    expect(kit.subjects[0]?.sourceQuery.params).toMatchObject({
      mode: 'by_subject_id',
      selected_subject_id: 'A',
      search_all_curriculum: 'true',
    });
  });

  it('records a failed read as unread and a missing course as no planned group', () => {
    const partial = buildRegistrationKit({
      plan,
      results: new Map([
        ['A', null],
        ['B', catalogOf()],
      ]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    expect(partial.unread).toEqual(['A']);
    expect(partial.subjects[0]?.subjectId).toBe('B');
    expect(partial.subjects[0]?.plannedIds).toEqual([]);
    expect(partial.subjects[0]?.nameTh).toBe('วิชา');
  });

  it('keeps a declared pair as one option', () => {
    const lecture = makeSection({
      teachTableId: 'L1',
      subjectId: 'P',
      section: '1',
      pairedSection: '101',
    });
    const practice = makeSection({
      teachTableId: 'P101',
      subjectId: 'P',
      section: '101',
      kind: 'practice',
      pairedSection: '1',
      meetings: [TUESDAY_NINE],
    });
    const course = makeCourse({
      subjectId: 'P',
      sections: [lecture, practice],
    });
    const pairKit = buildRegistrationKit({
      plan: makePlan({
        entries: [entryFor(course, lecture), entryFor(course, practice)],
      }),
      results: new Map([['P', catalogOf(course)]]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    expect(pairKit.subjects[0]?.options).toHaveLength(1);
    expect(pairKit.subjects[0]?.options[0]?.ids).toEqual(['L1', 'P101']);
    expect(pairKit.subjects[0]?.plannedIds).toEqual(['L1', 'P101']);
  });
});

describe('duplicate section codes', () => {
  const own = makeSection({
    teachTableId: 'D-own',
    subjectId: 'D',
    section: '101',
    offeredTo: [
      {
        facultyId: '01',
        departmentId: '05',
        curriculumId: '7',
        classYear: '2',
      },
    ],
  });
  const other = makeSection({
    teachTableId: 'D-other',
    subjectId: 'D',
    section: '101',
    offeredTo: [
      {
        facultyId: '01',
        departmentId: '06',
        curriculumId: '12',
        classYear: '2',
      },
    ],
  });
  const course = makeCourse({ subjectId: 'D', sections: [other, own] });
  const stale = { ...own, teachTableId: 'D-old' };

  it('flags the code and prefers the row of the curriculum the entry searched', () => {
    const kit = buildRegistrationKit({
      plan: makePlan({
        entries: [entryFor(course, stale, { selected_curriculum: '07' })],
      }),
      results: new Map([['D', catalogOf(course)]]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    const subject = kit.subjects[0];
    expect(subject?.duplicateCodes).toEqual(['101']);
    expect(subject?.plannedIds).toEqual(['D-own']);
    expect(
      subject?.options.find((option) => option.ids[0] === 'D-own')
        ?.ownCurriculum,
    ).toBe(true);
    expect(
      subject?.options.find((option) => option.ids[0] === 'D-other')
        ?.ownCurriculum,
    ).toBe(false);
  });

  it('falls back to the profile curriculum, then to the first row', () => {
    const plan = makePlan({ entries: [entryFor(course, stale)] });
    const results = new Map([['D', catalogOf(course)]]);
    const preparedAt = '2026-11-22T14:10:00.000Z';
    expect(
      buildRegistrationKit({
        plan,
        results,
        preparedAt,
        profileCurriculum: '7',
      }).subjects[0]?.plannedIds,
    ).toEqual(['D-own']);
    const unknown = buildRegistrationKit({ plan, results, preparedAt });
    expect(unknown.subjects[0]?.plannedIds).toEqual(['D-other']);
    expect(unknown.subjects[0]?.options[0]?.ownCurriculum).toBeNull();
  });

  it('reads no curriculum from an all curricula search', () => {
    expect(
      entryCurriculum([entryFor(course, own, { selected_curriculum: 'x' })]),
    ).toBeNull();
    expect(
      entryCurriculum([entryFor(course, own, { selected_curriculum: 'all' })]),
    ).toBeNull();
  });
});

describe('kit age and term', () => {
  const kit = buildRegistrationKit({
    plan: makePlan({ entries: [entryFor(COURSE_A, A1)] }),
    results: new Map([['A', catalogOf(COURSE_A)]]),
    preparedAt: '2026-11-20T00:00:00.000Z',
  });
  const prepared = Date.parse(kit.preparedAt);

  it('stands for seven days and no longer', () => {
    expect(isKitFresh(kit, prepared + KIT_MAX_AGE_MS)).toBe(true);
    expect(isKitFresh(kit, prepared + KIT_MAX_AGE_MS + 1)).toBe(false);
  });

  it('counts a kit stamped in the future as stale', () => {
    expect(isKitFresh(kit, prepared - 1)).toBe(false);
  });

  it('matches only its own plan in its own term', () => {
    expect(kitMatchesPlan(kit, makePlan())).toBe(true);
    expect(kitMatchesPlan(kit, makePlan({ semester: '2', entries: [] }))).toBe(
      false,
    );
    expect(kitMatchesPlan(kit, makePlan({ id: 'other' }))).toBe(false);
  });
});

describe('summarizeKit', () => {
  it('counts ready subjects, fitting alternatives, and what needs attention', () => {
    const ruled = { ...A1, rulesTh: 'ต้องผ่าน 01476105', rulesEn: '' };
    const course = makeCourse({ subjectId: 'A', sections: [ruled, A2, A3] });
    const kit = buildRegistrationKit({
      plan: makePlan({
        entries: [entryFor(course, ruled), entryFor(COURSE_B, B1)],
      }),
      results: new Map([
        ['A', catalogOf(course)],
        ['B', null],
      ]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    const summary = summarizeKit(kit);
    expect(summary).toMatchObject({ ready: 1, total: 2 });
    expect(summary.subjects).toEqual([
      // A2 clashes with B, which still holds its place though its read failed, and
      // A3 was full, so no other section of A both fits and had a seat.
      { subjectId: 'A', fittingAlternatives: 0, reasons: ['conditions'] },
      { subjectId: 'B', fittingAlternatives: 0, reasons: ['unread'] },
    ]);
    const [first] = kit.subjects;
    if (first === undefined) throw new Error('the kit lists no subject');
    expect(kitConditions(first, 'rulesTh')).toEqual(['ต้องผ่าน 01476105']);
    expect(plannedSections(first)).toHaveLength(1);
  });

  it('names a full planned section and a missing one', () => {
    const kit = buildRegistrationKit({
      plan: makePlan({ entries: [entryFor(COURSE_A, A3)] }),
      results: new Map([['A', catalogOf(COURSE_A)]]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    expect(summarizeKit(kit).subjects[0]).toEqual({
      subjectId: 'A',
      fittingAlternatives: 2,
      reasons: ['full'],
    });
    const gone = buildRegistrationKit({
      plan: makePlan({ entries: [entryFor(COURSE_A, A3)] }),
      results: new Map([['A', catalogOf(COURSE_B)]]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    expect(summarizeKit(gone).subjects[0]?.reasons).toEqual(['missing']);
  });
});

describe('refitKit', () => {
  it('follows a section saved to the plan without a read', () => {
    const plan = makePlan({
      entries: [entryFor(COURSE_A, A1), entryFor(COURSE_B, B1)],
    });
    const kit = buildRegistrationKit({
      plan,
      results: new Map([
        ['A', catalogOf(COURSE_A)],
        ['B', catalogOf(COURSE_B)],
      ]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    const moved = makePlan({ entries: [entryFor(COURSE_A, A2)] });
    const refit = refitKit(kit, moved);
    expect(refit.preparedAt).toBe(kit.preparedAt);
    expect(refit.subjects.map((subject) => subject.subjectId)).toEqual(['A']);
    expect(refit.subjects[0]?.plannedIds).toEqual(['A2']);
    // With B gone, A1 on Monday fits again.
    expect(
      refit.subjects[0]?.options.find((option) => option.ids[0] === 'A1')?.fit,
    ).toBe('fits');
  });

  it('reads a subject added after the kit as not prepared', () => {
    const kit = buildRegistrationKit({
      plan: makePlan({ entries: [entryFor(COURSE_A, A1)] }),
      results: new Map([['A', catalogOf(COURSE_A)]]),
      preparedAt: '2026-11-22T14:10:00.000Z',
    });
    const grown = makePlan({
      entries: [entryFor(COURSE_A, A1), entryFor(COURSE_B, B1)],
    });
    expect(refitKit(kit, grown).unread).toEqual(['B']);
  });
});
