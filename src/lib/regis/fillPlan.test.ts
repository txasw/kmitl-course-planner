import { describe, expect, it } from 'vitest';
import type { NormalizedCatalog } from '../domain/normalize';
import type { Course, Section } from '../domain/types';
import {
  makeCourse,
  makeMeeting,
  makePlan,
  makePlanEntry,
  makeSection,
} from '../../../tests/support/domain-builders';
import { toSnapshot } from '../planner/transaction';
import { buildRegistrationKit } from './kit';
import { deriveChecklist } from './checklist';
import type { HostObservation } from './hostObservation';
import {
  fillTarget,
  listClash,
  listedState,
  overCredits,
  overSubscribed,
  pageBlock,
  pickOption,
  type FillTarget,
} from './fillPlan';

// The pure decisions of a fill against a kit built from real domain sections.

const A = '01476107';
const B = '01476106';
const C = '01006010';
const monday = makeMeeting({ day: 1, startMin: 540, endMin: 720 });
const A1 = makeSection({
  teachTableId: 'A1',
  subjectId: A,
  section: '1',
  pairedSection: '101',
  meetings: [monday],
});
const A101 = makeSection({
  teachTableId: 'A101',
  subjectId: A,
  section: '101',
  kind: 'practice',
  pairedSection: '1',
  meetings: [makeMeeting({ day: 2, startMin: 780, endMin: 960 })],
});
const A2 = makeSection({
  teachTableId: 'A2',
  subjectId: A,
  section: '2',
  meetings: [makeMeeting({ day: 4, startMin: 540, endMin: 720 })],
});
// B meets when A's lecture does, so listing B makes A clash.
const B1 = makeSection({
  teachTableId: 'B1',
  subjectId: B,
  section: '1',
  meetings: [monday],
});
const C1 = makeSection({
  teachTableId: 'C1',
  subjectId: C,
  section: '1',
  meetings: [monday],
});
const courses: Course[] = [
  makeCourse({ subjectId: A, sections: [A1, A101, A2] }),
  makeCourse({ subjectId: B, sections: [B1] }),
  makeCourse({ subjectId: C, sections: [C1] }),
];

function entry(course: Course, section: Section) {
  return makePlanEntry({
    subjectId: section.subjectId,
    teachTableId: section.teachTableId,
    section: section.section,
    snapshot: toSnapshot(course, section),
  });
}

const [courseA, courseB] = courses as [Course, Course, Course];
const plan = makePlan({
  entries: [entry(courseA, A1), entry(courseA, A101), entry(courseB, B1)],
});
const catalog = (course: Course): NormalizedCatalog => ({
  courses: [course],
  duplicateCount: 0,
  multiMeetingCount: 0,
  warnings: [],
});
const kit = buildRegistrationKit({
  plan,
  results: new Map(
    courses.map((course) => [course.subjectId, catalog(course)]),
  ),
  preparedAt: '2026-11-22T14:10:00.000Z',
});
const rows = deriveChecklist({ plan, kit, marks: null, pageTerm: null }).rows;

function target(subjectId: string): FillTarget {
  const row = rows.find((item) => item.subjectId === subjectId);
  if (row === undefined) throw new Error('no row');
  const made = fillTarget(row, plan, kit);
  if (typeof made === 'string') throw new Error(made);
  return made;
}

function page(patch: Partial<HostObservation> = {}): HostObservation {
  return {
    step: 2,
    term: { year: '2569', semester: '1' },
    card: {
      status: 'empty',
      subjectId: null,
      colour: 'pending',
      primary: null,
      practice: null,
      practiceSelect: false,
      seats: null,
    },
    list: [],
    credits: { total: 0, min: 9, max: 22 },
    dialog: null,
    toasts: [],
    results: null,
    ...patch,
  };
}

describe('fillTarget', () => {
  it('fills the planned lecture and its practice from the kit', () => {
    const made = target(A);
    expect(made.id.value).toBe(A);
    expect(made.primary).toEqual({ code: '1', shared: false, listed: 2 });
    expect(made.practice).toEqual({ code: '101', shared: false, listed: 1 });
  });

  it('refuses a subject without a kit entry', () => {
    const row = rows[0];
    if (row === undefined) throw new Error('no row');
    expect(fillTarget(row, plan, null)).toBe('noKit');
  });

  it('refuses a planned code listed twice for its kind', () => {
    const row = rows.find((item) => item.subjectId === B);
    if (row === undefined) throw new Error('no row');
    expect(fillTarget({ ...row, duplicateCode: '1' }, plan, kit)).toBe(
      'duplicateCode',
    );
  });
});

describe('pageBlock', () => {
  it('lets a fill start on the choose subjects step of the plan term', () => {
    expect(pageBlock(page(), plan)).toBeNull();
  });

  it.each([
    ['no healthy reading', null, 'notRecognised'],
    ['another step', page({ step: 1, card: null }), 'notReady'],
    [
      'another term',
      page({ term: { year: '2570', semester: '1' } }),
      'termMismatch',
    ],
    [
      'the confirm dialog',
      page({ dialog: { kind: 'confirmSubmit', prerequisites: [] } }),
      'dialogOpen',
    ],
  ])('stops on %s', (_name, observation, reason) => {
    expect(pageBlock(observation, plan)).toBe(reason);
  });
});

describe('listedState', () => {
  const lecture = { subjectId: A, kind: 'lecture' as const, curriculum: null };
  it('reads the planned pair on the list as listed', () => {
    expect(
      listedState(
        page({
          list: [
            { ...lecture, section: '1' },
            { ...lecture, section: '101', kind: 'practice' },
          ],
        }),
        target(A),
      ),
    ).toBe('listed');
  });

  it('reads another section as other and an empty list as absent', () => {
    expect(
      listedState(page({ list: [{ ...lecture, section: '2' }] }), target(A)),
    ).toBe('other');
    expect(listedState(page(), target(A))).toBe('absent');
  });
});

describe('pickOption', () => {
  const half = { code: '1', shared: false, listed: 2 };

  it('picks the one option with the planned code', () => {
    expect(
      pickOption(
        [
          { section: '2', curriculum: null },
          { section: '1', curriculum: null },
        ],
        half,
      ),
    ).toBe(1);
  });

  it('stops when the code shows twice or with a suffix the kit cannot explain', () => {
    const twice = [
      { section: '1', curriculum: 'CE' },
      { section: '1', curriculum: 'EE' },
    ];
    expect(pickOption(twice, half)).toBe('duplicateCode');
    expect(pickOption([{ section: '1', curriculum: 'CE' }], half)).toBe(
      'duplicateCode',
    );
    expect(
      pickOption([{ section: '1', curriculum: 'CE' }], {
        ...half,
        shared: true,
      }),
    ).toBe(0);
  });

  it('tells a code the page does not offer from one beyond the first 20', () => {
    expect(pickOption([{ section: '2', curriculum: null }], half)).toBe(
      'refused',
    );
    const twenty = Array.from({ length: 20 }, (_, index) => ({
      section: String(index + 30),
      curriculum: null,
    }));
    expect(pickOption(twenty, { ...half, listed: 25 })).toBe('notVisible');
  });
});

describe('the checks KCP adds', () => {
  it('pauses on an over subscribed section only', () => {
    const card = page().card;
    if (card === null) throw new Error('no card');
    const seats = (limit: number | null, count: number) =>
      page({ card: { ...card, seats: { limit, count } } });
    expect(overSubscribed(seats(40, 45))).toBe(true);
    expect(overSubscribed(seats(40, 12))).toBe(false);
    expect(overSubscribed(seats(null, 99))).toBe(false);
  });

  it('finds a clash the host would skip against the page list', () => {
    const listed = {
      subjectId: B,
      section: '1',
      kind: 'lecture' as const,
      curriculum: null,
    };
    expect(listClash(page({ list: [listed] }), target(A), kit)).toBe(
      'kcpClash',
    );
    expect(listClash(page(), target(A), kit)).toBeNull();
  });

  it('stops on a list row it cannot resolve to the kit', () => {
    const unknown = {
      subjectId: C,
      section: '1',
      kind: 'lecture' as const,
      curriculum: null,
    };
    expect(listClash(page({ list: [unknown] }), target(A), kit)).toBe(
      'listUnknown',
    );
  });

  it('stops before the page total passes its credit limit', () => {
    expect(
      overCredits(page({ credits: { total: 21, min: 9, max: 22 } }), target(A)),
    ).toBe(true);
    expect(overCredits(page(), target(A))).toBe(false);
  });
});
