import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import type { Course } from '../domain/types';
import { normalizeTeachTable } from '../domain/normalize';
import { summarizeCourse } from './courseSummary';

function captured(name: string): Course[] {
  const result = normalizeTeachTable(loadFixture(name));
  if (!result.ok) throw new Error(`${name} failed to normalize`);
  return result.value.courses;
}

function course(courses: Course[], subjectId: string): Course {
  const found = courses.find((entry) => entry.subjectId === subjectId);
  if (found === undefined) throw new Error(`expected ${subjectId}`);
  return found;
}

const BY_CLASS = captured('teach-table.by_class.capture.json');
const GENED = captured('teach-table.by_subject_owner_id-32.capture.json');

describe('summarizeCourse over the captures', () => {
  it('counts the by_class capture as 12 courses and 35 sections', () => {
    expect(BY_CLASS).toHaveLength(12);
    const total = BY_CLASS.reduce(
      (sum, entry) =>
        sum + summarizeCourse(entry, [], false, 'th').sectionCount,
      0,
    );
    expect(total).toBe(35);
  });

  it('reads every open section of an empty plan as addable', () => {
    const summary = summarizeCourse(
      course(BY_CLASS, '01006020'),
      [],
      false,
      'en',
    );
    expect(summary).toEqual({
      sectionCount: 2,
      days: [2],
      dayList: 'Tuesday',
      scheduled: true,
      fit: { kind: 'addable', count: 2 },
    });
  });

  it('reads a course whose sections are all full as unavailable', () => {
    const summary = summarizeCourse(
      course(BY_CLASS, '90641007'),
      [],
      false,
      'th',
    );
    expect(summary.sectionCount).toBe(18);
    expect(summary.fit).toEqual({ kind: 'allUnavailable' });
  });

  it('lists the union of meeting days, sorted, in the locale list format', () => {
    const summary = summarizeCourse(
      course(BY_CLASS, '01006021'),
      [],
      false,
      'th',
    );
    expect(summary.days).toEqual([2, 3]);
    expect(summary.dayList).toBe('วันอังคารและวันพุธ');
  });

  it('reads every section that clashes with a placed one as all conflict', () => {
    // 01476012 section 33 takes Friday morning, the only time 90592008 meets.
    const placed = course(BY_CLASS, '01476012').sections.slice(0, 1);
    const summary = summarizeCourse(
      course(GENED, '90592008'),
      placed,
      false,
      'th',
    );
    expect(summary.fit).toEqual({ kind: 'allConflict' });
  });

  it('counts only the sections that fit when some clash', () => {
    // 01006020 section 4 takes Tuesday morning, which clashes with 01006021 section
    // 3, while its section 5 on Wednesday afternoon still fits.
    const placed = course(BY_CLASS, '01006020').sections.slice(0, 1);
    const summary = summarizeCourse(
      course(BY_CLASS, '01006021'),
      placed,
      false,
      'th',
    );
    expect(summary.fit).toEqual({ kind: 'addable', count: 1 });
  });

  it('reads the GenEd pair, both halves full, as unavailable', () => {
    const summary = summarizeCourse(course(GENED, '90592033'), [], false, 'th');
    expect(summary.sectionCount).toBe(2);
    expect(summary.days).toEqual([5]);
    expect(summary.fit).toEqual({ kind: 'allUnavailable' });
  });
});

describe('summarizeCourse branches', () => {
  const morning = makeMeeting({ day: 1, startMin: 540, endMin: 720 });
  const blocker = makeSection({
    teachTableId: 'p',
    subjectId: 'OTHER',
    section: '900',
    meetings: [morning],
  });

  it('counts only the sections a filter kept', () => {
    const full = makeCourse({
      sections: [
        makeSection({ teachTableId: 'a', section: '901' }),
        makeSection({
          teachTableId: 'b',
          section: '902',
          meetings: [makeMeeting({ day: 3 })],
        }),
      ],
    });
    const filtered = { ...full, sections: full.sections.slice(0, 1) };
    expect(summarizeCourse(full, [], false, 'th')).toMatchObject({
      sectionCount: 2,
      days: [1, 3],
      fit: { kind: 'addable', count: 2 },
    });
    expect(summarizeCourse(filtered, [], false, 'th')).toMatchObject({
      sectionCount: 1,
      days: [1],
      fit: { kind: 'addable', count: 1 },
    });
  });

  it('reads a course with no meeting at all as unscheduled', () => {
    const online = makeCourse({
      sections: [makeSection({ teachTableId: 'a', meetings: [] })],
    });
    expect(summarizeCourse(online, [], false, 'th')).toMatchObject({
      days: [],
      dayList: '',
      scheduled: false,
    });
  });

  it('lists only the scheduled days of a mixed course', () => {
    const mixed = makeCourse({
      sections: [
        makeSection({ teachTableId: 'a', meetings: [] }),
        makeSection({
          teachTableId: 'b',
          section: '902',
          meetings: [makeMeeting({ day: 4 })],
        }),
      ],
    });
    expect(summarizeCourse(mixed, [], false, 'en')).toMatchObject({
      days: [4],
      dayList: 'Thursday',
      scheduled: true,
    });
  });

  it('skips the classification for a cross term course', () => {
    const clashing = makeCourse({
      sections: [makeSection({ teachTableId: 'a', meetings: [morning] })],
    });
    expect(summarizeCourse(clashing, [blocker], true, 'th').fit).toEqual({
      kind: 'crossTerm',
    });
  });

  it('counts an exam only clash as all conflict', () => {
    const exam = {
      final: { start: '2026-10-30 09:30:00', end: '2026-10-30 12:30:00' },
    };
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'OTHER',
      section: '900',
      meetings: [makeMeeting({ day: 5 })],
      exam,
    });
    const examClash = makeCourse({
      sections: [makeSection({ teachTableId: 'a', meetings: [morning], exam })],
    });
    expect(summarizeCourse(examClash, [placed], false, 'th').fit).toEqual({
      kind: 'allConflict',
    });
  });

  it('expands a declared pair so a clash on one half blocks both', () => {
    const lecture = makeSection({
      teachTableId: 'l',
      section: '901',
      pairedSection: '902',
      meetings: [makeMeeting({ day: 2 })],
    });
    const lab = makeSection({
      teachTableId: 'p2',
      section: '902',
      pairedSection: '901',
      kind: 'practice',
      meetings: [morning],
    });
    const paired = makeCourse({ sections: [lecture, lab] });
    expect(summarizeCourse(paired, [], false, 'th').fit).toEqual({
      kind: 'addable',
      count: 2,
    });
    expect(summarizeCourse(paired, [blocker], false, 'th').fit).toEqual({
      kind: 'allConflict',
    });
  });

  it('reads a mix of clashing and full sections as none addable', () => {
    const mix = makeCourse({
      sections: [
        makeSection({ teachTableId: 'a', meetings: [morning] }),
        makeSection({ teachTableId: 'b', section: '902', isClosed: true }),
      ],
    });
    expect(summarizeCourse(mix, [blocker], false, 'th').fit).toEqual({
      kind: 'noneAddable',
    });
  });

  it('reads a course whose only section is placed as none addable', () => {
    const only = makeSection({ teachTableId: 'a' });
    const added = makeCourse({ sections: [only] });
    expect(summarizeCourse(added, [only], false, 'th').fit).toEqual({
      kind: 'noneAddable',
    });
  });
});
