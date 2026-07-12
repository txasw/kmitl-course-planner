import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../../tests/support/fixtures';
import { auditTeachTable, auditReference, DEBUG_CANARY } from './auditor';
import { dropTeachTime2, injectUnknownField } from './mutations';
import {
  FACULTY_EXPECTATIONS,
  DEPARTMENT_EXPECTATIONS,
  CURRICULUM_EXPECTATIONS,
  SUBJECT_OWNER_EXPECTATIONS,
  type FieldExpectation,
} from './expectations';

const ctx = {
  extensionVersion: '0.0.0',
  generatedAt: '2026-07-07T00:00:00.000Z',
  request: { endpoint: 'get-teach-table-show', params: { mode: 'by_class' } },
};

const OWNER_CAPTURE = 'teach-table.by_subject_owner_id-32.capture.json';

function validRow(): Record<string, unknown> {
  return {
    teach_table_id: 't1',
    subject_id: '90592033',
    subject_name_th: 'x',
    subject_name_en: 'x',
    credit: '3',
    credit_lps: '(3-0-6)',
    credit_str: '3(3-0-6)',
    section: '901',
    sec_pair: null,
    lect_or_prac: 'ท',
    teach_day: '6',
    teach_time: '08:00:00',
    teach_time2: '10:00:00',
    teachtime_str: '',
    classroom: null,
    room_no: 'A101',
    classbuilding: null,
    building_no: 'A',
    teacher_list_th: '<div>A</div>',
    teacher_list_en: '<div>A</div>',
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
    count: 62,
    class_group_display: 0,
  };
}

function wrap(row: Record<string, unknown>): unknown {
  return [
    {
      teachtable: [
        { subject_type_name_th: 'g', subject_type_name_en: 'g', data: [row] },
      ],
    },
  ];
}

describe('auditTeachTable', () => {
  it('embeds the debug canary', () => {
    expect(DEBUG_CANARY).toBe('kcp-debug-canary');
  });

  it('finds no issues in a clean row and carries report metadata', () => {
    const report = auditTeachTable(wrap(validRow()), ctx);
    expect(report.totals.issues).toBe(0);
    expect(report.reportVersion).toBe(1);
    expect(report.extensionVersion).toBe('0.0.0');
    expect(report.request).toEqual(ctx.request);
  });

  it('accepts an unscheduled row without a day or time error', () => {
    // teach_day 0 with 00:00:00 times is the API's unscheduled online course, a
    // valid state, so it flags neither value_out_of_range nor cross_field.
    const row = {
      ...validRow(),
      teach_day: '0',
      teach_time: '00:00:00',
      teach_time2: '00:00:00',
    };
    const report = auditTeachTable(wrap(row), ctx);
    expect(report.totals.issues).toBe(0);
    // The valid unscheduled row is counted so a mass day zero spike is visible.
    expect(report.totals.unscheduled).toBe(1);
  });

  it('flags a day 0 row that still carries real times', () => {
    // The unscheduled sentinel must come with zeroed times; a day 0 row with real
    // times is a meeting mislabeled to day 0, which the cross field rule surfaces.
    const row = {
      ...validRow(),
      teach_day: '0',
      teach_time: '09:00:00',
      teach_time2: '12:00:00',
    };
    const report = auditTeachTable(wrap(row), ctx);
    expect(report.totals.byKind.cross_field).toBe(1);
    expect(report.totals.issues).toBe(1);
    // A mislabeled day 0 row is not the unscheduled sentinel, so it is not counted.
    expect(report.totals.unscheduled).toBe(0);
  });

  it('classifies every issue kind on a corrupted row', () => {
    const row: Record<string, unknown> = {
      ...validRow(),
      subject_id: '123',
      teach_day: '9',
      count: 'Full',
      subject_name_th: null,
      teach_time: '10:00:00',
      teach_time2: '08:00:00',
      server_added_field: 'x',
    };
    delete row.credit;
    const report = auditTeachTable(wrap(row), ctx);
    expect(report.totals.issues).toBe(7);
    expect(report.totals.byKind).toEqual({
      missing_field: 1,
      unexpected_null: 1,
      type_mismatch: 1,
      format_violation: 1,
      value_out_of_range: 1,
      cross_field: 1,
      unknown_field: 1,
    });
  });

  it('warns rather than errors on a teachtime_str that breaks the grammar', () => {
    // A display string is not the machine grammar. The primary meeting still
    // renders, so the drift is a warn severity format_violation, not an error.
    const row = { ...validRow(), teachtime_str: 'จ. 09:00-12:00' };
    const report = auditTeachTable(wrap(row), ctx);
    expect(report.totals.byKind.format_violation).toBe(1);
    const violation = report.issues.find(
      (candidate) => candidate.kind === 'format_violation',
    );
    expect(violation?.path).toMatch(/\.teachtime_str$/);
    expect(violation?.severity).toBe('warn');
  });

  it('accepts a machine grammar teachtime_str and counts the extra meeting', () => {
    const row = { ...validRow(), teachtime_str: '5x10:30-12:00' };
    const report = auditTeachTable(wrap(row), ctx);
    expect(report.totals.issues).toBe(0);
    expect(report.totals.extraMeetings).toBe(1);
  });

  it('counts the extra meeting rows in the multi meeting capture', () => {
    const report = auditTeachTable(
      loadFixture('teach-table.multi-meeting.capture.json'),
      ctx,
    );
    expect(report.totals.extraMeetings).toBe(6);
  });

  it('audits the owner capture clean and counts dedupe', () => {
    const report = auditTeachTable(loadFixture(OWNER_CAPTURE), ctx);
    expect(report.totals.rows).toBe(13);
    expect(report.totals.deduped).toBe(4);
    expect(report.totals.issues).toBe(0);
    // The owner capture has no unscheduled rows, so the counter reads zero.
    expect(report.totals.unscheduled).toBe(0);
  });

  it('counts the unscheduled row in the day zero regression capture', () => {
    const report = auditTeachTable(
      loadFixture(
        'regressions/teach-table.by_class-null-teachtime-str.capture.json',
      ),
      ctx,
    );
    // The capture carries one online course whose day is 0 and times are zeroed.
    expect(report.totals.unscheduled).toBe(1);
  });

  it('flags exactly one missing field and one unknown field for the mutation presets', () => {
    const capture = loadFixture(OWNER_CAPTURE);
    const mutated = injectUnknownField.apply(dropTeachTime2.apply(capture));
    const report = auditTeachTable(mutated, ctx);

    expect(report.totals.issues).toBe(2);
    expect(report.totals.byKind.missing_field).toBe(1);
    expect(report.totals.byKind.unknown_field).toBe(1);

    const missing = report.issues.find((i) => i.kind === 'missing_field');
    expect(missing?.path).toMatch(/\.teach_time2$/);
    expect(
      missing?.rowRef.teachTableId ?? missing?.rowRef.subjectId,
    ).toBeDefined();

    const unknown = report.issues.find((i) => i.kind === 'unknown_field');
    expect(unknown?.path).toMatch(/\.server_added_field$/);
  });
});

describe('auditReference', () => {
  const cases: [string, readonly FieldExpectation[]][] = [
    ['faculty.capture.json', FACULTY_EXPECTATIONS],
    ['department.capture.json', DEPARTMENT_EXPECTATIONS],
    ['curriculum.level1.capture.json', CURRICULUM_EXPECTATIONS],
    ['subject-owner.capture.json', SUBJECT_OWNER_EXPECTATIONS],
  ];

  it.each(cases)('audits %s with no issues', (name, expectations) => {
    const report = auditReference(loadFixture(name), expectations, ctx);
    expect(report.totals.issues).toBe(0);
  });
});
