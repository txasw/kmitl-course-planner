import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import { normalizeTeachTable } from './normalize';
import type { Course } from './types';
import type { RawSectionRow } from './schemas';

function normalizeFixture(name: string): {
  courses: Course[];
  duplicateCount: number;
  multiMeetingCount: number;
  warningCount: number;
} {
  const result = normalizeTeachTable(loadFixture(name));
  if (!result.ok) {
    throw new Error(`fixture ${name} failed to normalize`);
  }
  return {
    courses: result.value.courses,
    duplicateCount: result.value.duplicateCount,
    multiMeetingCount: result.value.multiMeetingCount,
    warningCount: result.value.warnings.length,
  };
}

function findSection(courses: Course[], subjectId: string, section: string) {
  const found = courses
    .find((course) => course.subjectId === subjectId)
    ?.sections.find((candidate) => candidate.section === section);
  if (found === undefined) {
    throw new Error(`section ${subjectId}/${section} not found`);
  }
  return found;
}

function totalSections(courses: Course[]): number {
  return courses.reduce((sum, course) => sum + course.sections.length, 0);
}

function makeRow(overrides: Partial<RawSectionRow> = {}): RawSectionRow {
  return {
    teach_table_id: '1',
    subject_id: '90000001',
    subject_name_th: 'วิชา',
    subject_name_en: 'Subject',
    credit: '3',
    credit_lps: '(3-0-6)',
    credit_str: '3(3-0-6)',
    section: '901',
    sec_pair: null,
    lect_or_prac: 'ท',
    teach_day: '2',
    teach_time: '09:00:00',
    teach_time2: '12:00:00',
    teachtime_str: '',
    classroom: null,
    room_no: 'A101',
    classbuilding: null,
    building_no: 'A',
    teacher_list_th: '<div>อ. ทดสอบ</div>',
    teacher_list_en: '<div>Mr. Test</div>',
    midterm_start_date_time: null,
    midterm_end_date_time: null,
    final_start_date_time: null,
    final_end_date_time: null,
    exam_text_detail: null,
    rules_th: '',
    rules_en: '',
    remark: '',
    closed: '0',
    limit: '40',
    pre_count: 0,
    queue_left: 40,
    count: 10,
    class_group_display: 0,
    ...overrides,
  };
}

function makeResponse(rows: RawSectionRow[]): unknown {
  return [
    {
      faculty_id: '01',
      department_id: '01',
      curriculum2_id: '01',
      class: '1',
      faculty_name_th: 'คณะ',
      faculty_name_en: 'Faculty',
      department_name_th: null,
      department_name_en: null,
      curriculum_name_th: null,
      curriculum_name_en: null,
      teachtable: [
        {
          subject_type_name_th: 'กลุ่ม 1',
          subject_type_name_en: 'Group 1',
          data: rows,
        },
      ],
    },
  ];
}

describe('deduplication against real captures', () => {
  it('collapses the owner capture to four unique sections in three courses', () => {
    const { courses, duplicateCount } = normalizeFixture(
      'teach-table.by_subject_owner_id-32.capture.json',
    );
    expect(courses).toHaveLength(3);
    expect(totalSections(courses)).toBe(4);
    expect(duplicateCount).toBe(9);
  });

  it('leaves the by_class capture at thirty five sections with no duplicates', () => {
    const { courses, duplicateCount } = normalizeFixture(
      'teach-table.by_class.capture.json',
    );
    expect(totalSections(courses)).toBe(35);
    expect(duplicateCount).toBe(0);
  });

  it('collapses the by_subject_id capture from 499 rows to 44 sections', () => {
    const { courses, duplicateCount } = normalizeFixture(
      'teach-table.by_subject_id.capture.json',
    );
    expect(courses).toHaveLength(1);
    expect(totalSections(courses)).toBe(44);
    expect(duplicateCount).toBe(455);
  });

  it('produces no warnings for clean captured data', () => {
    expect(
      normalizeFixture('teach-table.by_subject_owner_id-32.capture.json')
        .warningCount,
    ).toBe(0);
    expect(
      normalizeFixture('teach-table.by_class.capture.json').warningCount,
    ).toBe(0);
  });
});

describe('teachtime_str additional meetings', () => {
  it('reads a second meeting from teachtime_str on the QA case', () => {
    // Subject 01476101 section 34 meets twice on the same Thursday: the primary
    // 08:45 to 10:15 and the teachtime_str period 10:30 to 12:00. Day 5 is
    // Thursday (DayOfWeek 4).
    const { courses } = normalizeFixture(
      'teach-table.multi-meeting.capture.json',
    );
    const section = findSection(courses, '01476101', '34');
    expect(section.meetings).toEqual([
      {
        day: 4,
        startMin: 525,
        endMin: 615,
        room: 'E12- 506',
        building: 'E12',
        kind: 'lecture',
      },
      {
        day: 4,
        startMin: 630,
        endMin: 720,
        room: 'E12- 506',
        building: 'E12',
        kind: 'lecture',
      },
    ]);
  });

  it('counts the multi meeting sections in the multi meeting capture', () => {
    const { multiMeetingCount } = normalizeFixture(
      'teach-table.multi-meeting.capture.json',
    );
    expect(multiMeetingCount).toBe(6);
  });

  it('reads a section that totals three meetings from two extra segments', () => {
    // Subject 01076311 section 1 carries a primary and two teachtime_str periods
    // on the same day, so it totals three meetings.
    const { courses, multiMeetingCount } = normalizeFixture(
      'teach-table.with-exams.capture.json',
    );
    const section = findSection(courses, '01076311', '1');
    expect(section.meetings).toHaveLength(3);
    expect(multiMeetingCount).toBe(9);
  });

  it('leaves clean single meeting captures with no extra meetings', () => {
    expect(
      normalizeFixture('teach-table.by_subject_owner_id-32.capture.json')
        .multiMeetingCount,
    ).toBe(0);
    expect(
      normalizeFixture('teach-table.by_class.capture.json').multiMeetingCount,
    ).toBe(0);
  });

  it('appends a teachtime_str meeting inheriting the row room and kind', () => {
    const result = normalizeTeachTable(
      makeResponse([makeRow({ teachtime_str: '5x10:30-12:00' })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const section = result.value.courses[0]?.sections[0];
      expect(section?.meetings).toEqual([
        {
          day: 1,
          startMin: 540,
          endMin: 720,
          room: 'A101',
          building: 'A',
          kind: 'lecture',
        },
        {
          day: 4,
          startMin: 630,
          endMin: 720,
          room: 'A101',
          building: 'A',
          kind: 'lecture',
        },
      ]);
      expect(result.value.warnings).toHaveLength(0);
    }
  });

  it('warns on a malformed teachtime_str while keeping the primary meeting', () => {
    const result = normalizeTeachTable(
      makeResponse([makeRow({ teachtime_str: 'not a time' })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const section = result.value.courses[0]?.sections[0];
      expect(section?.meetings).toHaveLength(1);
      expect(result.value.warnings).toHaveLength(1);
      expect(result.value.warnings[0]?.reason).toContain('teachtime_str');
    }
  });

  it('dedupes a teachtime_str segment that repeats the primary meeting', () => {
    // The primary is day 2 (Monday) 09:00 to 12:00; the segment re encodes it, so
    // the section ends with one meeting, not two, and never self conflicts.
    const result = normalizeTeachTable(
      makeResponse([makeRow({ teachtime_str: '2x09:00-12:00' })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.courses[0]?.sections[0]?.meetings).toHaveLength(1);
      expect(result.value.multiMeetingCount).toBe(0);
    }
  });

  it('keeps teachtime_str meetings on an unscheduled row and warns of the mix', () => {
    const result = normalizeTeachTable(
      makeResponse([
        makeRow({
          teach_day: '0',
          teach_time: '00:00:00',
          teach_time2: '00:00:00',
          teachtime_str: '3x10:30-12:00',
        }),
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const section = result.value.courses[0]?.sections[0];
      expect(section?.meetings).toEqual([
        {
          day: 2,
          startMin: 630,
          endMin: 720,
          room: 'A101',
          building: 'A',
          kind: 'lecture',
        },
      ]);
      expect(
        result.value.warnings.some((warning) =>
          warning.reason.includes('unscheduled'),
        ),
      ).toBe(true);
    }
  });
});

describe('pair linking and field normalization', () => {
  const { courses } = normalizeFixture(
    'teach-table.by_subject_owner_id-32.capture.json',
  );
  const paired = courses.find((c) => c.subjectId === '90592033');

  it('links the lecture and practice pair bidirectionally', () => {
    expect(paired).toBeDefined();
    expect(paired?.sections.map((s) => s.section)).toEqual(['901', '902']);
    const [lecture, practice] = paired?.sections ?? [];
    expect(lecture?.teachTableId).toBe('135273');
    expect(lecture?.pairedSection).toBe('902');
    expect(practice?.teachTableId).toBe('135274');
    expect(practice?.pairedSection).toBe('901');
  });

  it('parses the paired lecture meeting from day and time', () => {
    const lecture = paired?.sections[0];
    expect(lecture?.meetings).toHaveLength(1);
    expect(lecture?.meetings[0]).toMatchObject({
      day: 5,
      startMin: 480,
      endMin: 600,
      kind: 'lecture',
    });
  });

  it('reduces the count union to a discriminated enrolled value', () => {
    const full = paired?.sections[0];
    expect(full?.seats.enrolled).toBe('full');
    const open = courses
      .find((c) => c.subjectId === '90592008')
      ?.sections.find((s) => s.teachTableId === '135224');
    expect(open?.seats.enrolled).toBe(62);
  });

  it('sanitizes multi teacher rows into plain text lines', () => {
    const multi = courses
      .find((c) => c.subjectId === '90592004')
      ?.sections.find((s) => s.teachTableId === '135340');
    expect(multi?.teachersTh).toHaveLength(2);
    expect(multi?.teachersTh.every((name) => !name.includes('<'))).toBe(true);
  });
});

describe('malformed rows and invalid input', () => {
  it('refines the uncapped limit dash to null and a numeric limit to a number', () => {
    const result = normalizeTeachTable(
      makeResponse([
        makeRow({ teach_table_id: 'a', section: '901', limit: '-' }),
        makeRow({ teach_table_id: 'b', section: '902', limit: '80' }),
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const [uncapped, capped] = result.value.courses[0]?.sections ?? [];
      expect(uncapped?.seats.limit).toBeNull();
      expect(capped?.seats.limit).toBe(80);
    }
  });

  it('records a warning per unparseable row without dropping the section', () => {
    const result = normalizeTeachTable(
      makeResponse([
        makeRow({ teach_table_id: 'good', section: '901' }),
        makeRow({ teach_table_id: 'badday', section: '902', teach_day: '9' }),
        makeRow({
          teach_table_id: 'badtime',
          section: '903',
          teach_time: '12:00:00',
          teach_time2: '09:00:00',
        }),
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings).toHaveLength(2);
      expect(result.value.warnings.map((w) => w.section).sort()).toEqual([
        '902',
        '903',
      ]);
      const sections = result.value.courses[0]?.sections ?? [];
      expect(sections).toHaveLength(3);
      const badDay = sections.find((s) => s.section === '902');
      expect(badDay?.meetings).toHaveLength(0);
    }
  });

  it('treats an unscheduled row as a no meeting section without a warning', () => {
    // Regression: the all curricula query surfaces unscheduled online courses
    // with teachtime_str null, teach_day "0", and 00:00:00 times. The null must
    // pass the gate, and the row is a legitimate no meeting section, not a
    // malformed one, so it records no warning.
    const result = normalizeTeachTable(
      loadFixture(
        'regressions/teach-table.by_class-null-teachtime-str.capture.json',
      ),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.courses).toHaveLength(2);
      const unscheduled = result.value.courses.find(
        (course) => course.subjectId === '01006029',
      );
      expect(unscheduled?.sections[0]?.meetings).toHaveLength(0);
      expect(unscheduled?.sections[0]?.kind).toBe('lecture');
      expect(
        result.value.warnings.some((w) => w.subjectId === '01006029'),
      ).toBe(false);
    }
  });

  it('carries the practice kind on an unscheduled section', () => {
    // The lecture or practice designation comes from lect_or_prac, not from a
    // meeting, so an unscheduled practice section still reports kind "practice"
    // for its badge even though it produces no meeting.
    const result = normalizeTeachTable(
      makeResponse([
        makeRow({
          lect_or_prac: 'ป',
          teach_day: '0',
          teach_time: '00:00:00',
          teach_time2: '00:00:00',
        }),
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const section = result.value.courses[0]?.sections[0];
      expect(section?.meetings).toHaveLength(0);
      expect(section?.kind).toBe('practice');
    }
  });

  it('warns on a day 0 row that still carries real times', () => {
    // Only teach_day 0 with zeroed times is unscheduled. A day 0 row with real
    // times is a meeting mislabeled to day 0, so it warns rather than vanishing.
    const result = normalizeTeachTable(
      makeResponse([
        makeRow({
          teach_table_id: 'mislabeled',
          section: '900',
          teach_day: '0',
          teach_time: '09:00:00',
          teach_time2: '12:00:00',
        }),
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings).toHaveLength(1);
      expect(result.value.warnings[0]?.section).toBe('900');
      expect(result.value.courses[0]?.sections[0]?.meetings).toHaveLength(0);
    }
  });

  it('warns on a non null exam datetime that fails the format', () => {
    // A malformed but present exam datetime is stored on the snapshot yet treated as no
    // window by the gate. It records a warning so an exam silently losing its format is
    // distinguishable from an exam that was never announced.
    const result = normalizeTeachTable(
      makeResponse([
        makeRow({
          teach_table_id: 'badexam',
          section: '905',
          midterm_start_date_time: '2026-08-21T09:30:00',
          midterm_end_date_time: '2026-08-21 12:30:00',
        }),
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings).toHaveLength(1);
      expect(result.value.warnings[0]?.section).toBe('905');
      expect(result.value.warnings[0]?.reason).toContain('midterm start');
    }
  });

  it('records no warning for a null or well formed exam datetime', () => {
    const result = normalizeTeachTable(
      makeResponse([
        makeRow({ teach_table_id: 'noexam', section: '906' }),
        makeRow({
          teach_table_id: 'goodexam',
          section: '907',
          final_start_date_time: '2026-10-30 09:30:00',
          final_end_date_time: '2026-10-30 12:30:00',
        }),
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings).toHaveLength(0);
    }
  });

  it('returns a validation error for a non array response', () => {
    const result = normalizeTeachTable({ not: 'an array' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
    }
  });
});
