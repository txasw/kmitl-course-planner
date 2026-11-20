import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
} from '../../../tests/support/domain-builders';
import { curriculumCourse, lockSections } from '../../../tests/support/suggest';
import { suggestCandidates } from './suggestCandidates';
import { plannedSubjects } from './suggestSubjects';

const monday = [makeMeeting({ day: 1, startMin: 540, endMin: 720 })];
const tuesday = [makeMeeting({ day: 2, startMin: 540, endMin: 720 })];
const FULL = {
  limit: 40,
  preCount: 0,
  queueLeft: 0,
  enrolled: 'full' as const,
};

/** Every subject of the given courses, ticked. */
function ticked(...courses: { subjectId: string }[]): Set<string> {
  return new Set(courses.map((course) => course.subjectId));
}

describe('suggestCandidates', () => {
  it('puts the ticked plan subjects first, then the ticked result courses', () => {
    const general = makeCourse({ subjectId: '90000001' });
    const placed = curriculumCourse('11111111', [{}]);
    const open = curriculumCourse('22222222', [{}]);
    const courses = [general, placed, open];
    const planned = plannedSubjects(
      courses,
      lockSections(courses, [['11111111', '1']]),
    );
    const candidates = suggestCandidates(
      courses,
      ticked(placed, open),
      planned,
    );
    expect(candidates.map((c) => [c.course.subjectId, c.required])).toEqual([
      ['11111111', true],
      ['22222222', false],
    ]);
  });

  it('leaves out an unticked plan subject, and never offers it as a result course', () => {
    const placed = curriculumCourse('11111111', [{}]);
    const planned = plannedSubjects(
      [placed],
      lockSections([placed], [['11111111', '1']]),
    );
    expect(suggestCandidates([placed], new Set(), planned)).toEqual([]);
  });

  it('takes a ticked general course and drops an unticked curriculum one', () => {
    const general = makeCourse({ subjectId: '90000001' });
    const curriculum = curriculumCourse('11111111', [{}]);
    const candidates = suggestCandidates(
      [general, curriculum],
      ticked(general),
      [],
    );
    expect(candidates.map((c) => c.course.subjectId)).toEqual(['90000001']);
  });

  it('drops full and closed groups from the options', () => {
    const course = curriculumCourse('33333333', [
      { meetings: monday },
      { meetings: tuesday },
      { meetings: tuesday, isClosed: true },
      { meetings: tuesday, seats: FULL },
    ]);
    const [candidate] = suggestCandidates([course], ticked(course), []);
    expect(candidate?.open.map((g) => g.map((s) => s.section))).toEqual([
      ['1'],
      ['2'],
    ]);
    expect(candidate?.options.map((o) => o.choice.section.section)).toEqual([
      '1',
      '2',
    ]);
    expect(candidate?.options.every((o) => !o.choice.current)).toBe(true);
  });

  it('offers a plan subject its own group first, then the open groups at other times', () => {
    const course = curriculumCourse('44444444', [
      { meetings: monday },
      { meetings: monday },
      { meetings: tuesday },
      { meetings: tuesday, isClosed: true },
    ]);
    const planned = plannedSubjects(
      [course],
      lockSections([course], [['44444444', '2']]),
    );
    const [candidate] = suggestCandidates([course], ticked(course), planned);
    expect(candidate?.required).toBe(true);
    expect(
      candidate?.options.map((o) => [
        o.choice.section.section,
        o.choice.current,
      ]),
    ).toEqual([
      ['2', true],
      ['3', false],
    ]);
  });

  it('keeps the own group of a plan subject even when it is now full', () => {
    const course = curriculumCourse('55555555', [{ meetings: monday }]);
    const entries = lockSections([course], [['55555555', '1']]);
    const nowFull = curriculumCourse('55555555', [
      { meetings: monday, seats: FULL },
    ]);
    const [candidate] = suggestCandidates(
      [nowFull],
      ticked(nowFull),
      plannedSubjects([nowFull], entries),
    );
    expect(candidate?.options.map((o) => o.choice.current)).toEqual([true]);
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
    const [candidate] = suggestCandidates([course], ticked(course), []);
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
    const [candidate] = suggestCandidates([course], ticked(course), []);
    expect(candidate?.options.map((o) => o.choice.section.section)).toEqual([
      '1',
      '2',
    ]);
  });
});
