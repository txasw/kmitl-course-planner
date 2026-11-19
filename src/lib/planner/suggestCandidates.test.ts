import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { curriculumCourse } from '../../../tests/support/suggest';
import { suggestCandidates } from './suggestCandidates';
import { placedSections } from './transaction';

const monday = [makeMeeting({ day: 1, startMin: 540, endMin: 720 })];
const tuesday = [makeMeeting({ day: 2, startMin: 540, endMin: 720 })];

/** Every subject of the given courses, ticked. */
function ticked(...courses: { subjectId: string }[]): Set<string> {
  return new Set(courses.map((course) => course.subjectId));
}

describe('suggestCandidates', () => {
  it('keeps ticked courses that are not already in the plan', () => {
    const general = makeCourse({ subjectId: '90000001' });
    const placed = curriculumCourse('11111111', [{}]);
    const open = curriculumCourse('22222222', [{}]);
    const entry = makePlanEntry({
      snapshot: makeSnapshot({ subjectId: '11111111', teachTableId: 'l1' }),
    });
    const candidates = suggestCandidates(
      [general, placed, open],
      ticked(placed, open),
      [entry],
      placedSections([entry]),
    );
    expect(candidates.map((c) => c.course.subjectId)).toEqual(['22222222']);
  });

  it('takes a ticked general course and drops an unticked curriculum one', () => {
    const general = makeCourse({ subjectId: '90000001' });
    const curriculum = curriculumCourse('11111111', [{}]);
    const candidates = suggestCandidates(
      [general, curriculum],
      ticked(general),
      [],
      [],
    );
    expect(candidates.map((c) => c.course.subjectId)).toEqual(['90000001']);
  });

  it('drops full, closed, and locked clashing groups from the options', () => {
    const course = curriculumCourse('33333333', [
      { meetings: monday },
      { meetings: tuesday },
      { meetings: tuesday, isClosed: true },
      {
        meetings: tuesday,
        seats: { limit: 40, preCount: 0, queueLeft: 0, enrolled: 'full' },
      },
    ]);
    const locked = [
      makeSection({
        subjectId: '44444444',
        teachTableId: 'l',
        meetings: monday,
      }),
    ];
    const [candidate] = suggestCandidates([course], ticked(course), [], locked);
    expect(candidate?.open.map((g) => g.map((s) => s.section))).toEqual([
      ['1'],
      ['2'],
    ]);
    expect(candidate?.options.map((o) => o.choice.section.section)).toEqual([
      '2',
    ]);
  });

  it('offers a declared pair once and numbers options across courses', () => {
    const paired = curriculumCourse('55555555', [
      { pairedSection: '2', meetings: monday },
      { kind: 'practice', pairedSection: '1', meetings: tuesday },
    ]);
    const single = curriculumCourse('66666666', [
      { meetings: monday },
      { meetings: tuesday },
    ]);
    const candidates = suggestCandidates(
      [paired, single],
      ticked(paired, single),
      [],
      [],
    );
    expect(
      candidates[0]?.options.map((o) => o.choice.group.map((s) => s.section)),
    ).toEqual([['1', '2']]);
    expect(candidates.flatMap((c) => c.options.map((o) => o.index))).toEqual([
      0, 1, 2,
    ]);
  });

  it('offers sections that meet at the same times and exams once, lowest first', () => {
    const exam = {
      midterm: { start: '2026-08-17 09:30:00', end: '2026-08-17 12:30:00' },
    };
    const course = curriculumCourse('77777777', [
      { meetings: monday, exam },
      { meetings: tuesday, exam },
      { meetings: monday, exam },
      { meetings: tuesday, exam },
    ]);
    const [candidate] = suggestCandidates([course], ticked(course), [], []);
    expect(candidate?.open).toHaveLength(4);
    expect(candidate?.options.map((o) => o.choice.section.section)).toEqual([
      '1',
      '2',
    ]);
  });

  it('keeps same time sections apart when their exams differ', () => {
    const course = curriculumCourse('88888888', [
      {
        meetings: monday,
        exam: {
          final: { start: '2026-10-05 09:30:00', end: '2026-10-05 12:30:00' },
        },
      },
      {
        meetings: monday,
        exam: {
          final: { start: '2026-10-06 09:30:00', end: '2026-10-06 12:30:00' },
        },
      },
    ]);
    const [candidate] = suggestCandidates([course], ticked(course), [], []);
    expect(candidate?.options.map((o) => o.choice.section.section)).toEqual([
      '1',
      '2',
    ]);
  });
});
