import { describe, it, expect } from 'vitest';
import {
  makePlan,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { loadFixture } from '../../../tests/support/fixtures';
import { validate } from './schemas';
import { normalizeTeachTable } from './normalize';
import { buildSnapshot, planSchema, snapshotToSection } from './plan';
import type { OfferedTo } from './types';

const OFFERED: OfferedTo[] = [
  { facultyId: '01', departmentId: '08', curriculumId: '08', classYear: '4' },
  { facultyId: '01', departmentId: 'x', curriculumId: 'x', classYear: '0' },
];

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

describe('planSchema', () => {
  it('accepts a well formed plan built from a normalized snapshot', () => {
    const result = validate(planSchema, makePlan());
    expect(result.ok).toBe(true);
  });

  it('rejects an out of range semester', () => {
    // validate takes unknown, so an invalid value is passed as plain data
    // rather than cast through the typed builder.
    const result = validate(planSchema, { ...makePlan(), semester: '4' });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown verify status', () => {
    const plan = {
      ...makePlan(),
      entries: [{ ...makePlanEntry(), verifyStatus: 'stale' }],
    };
    expect(validate(planSchema, plan).ok).toBe(false);
  });

  it('rejects a snapshot missing a required field', () => {
    const snapshot: Record<string, unknown> = { ...makeSnapshot() };
    delete snapshot.meetings;
    const plan = {
      ...makePlan(),
      entries: [{ ...makePlanEntry(), snapshot }],
    };
    const result = validate(planSchema, plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.path.includes('meetings'))).toBe(
        true,
      );
    }
  });

  it('rejects a plan whose entry term differs from the plan term', () => {
    // The default entry carries a first semester source query; a second semester
    // plan holding it violates the one term per plan invariant.
    const plan = makePlan({ semester: '2' });
    const result = validate(planSchema, plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.error.issues.some((issue) => issue.path.includes('sourceQuery')),
      ).toBe(true);
    }
  });

  it('rejects an entry whose source query has no semester', () => {
    const entry = makePlanEntry();
    const plan = makePlan({
      entries: [
        {
          ...entry,
          sourceQuery: {
            endpoint: 'get-teach-table-show',
            params: { mode: 'by_class', selected_year: '2569' },
          },
        },
      ],
    });
    expect(validate(planSchema, plan).ok).toBe(false);
  });

  it('carries the durable identity and source query on each entry', () => {
    const plan = makePlan();
    const entry = plan.entries[0];
    expect(entry?.subjectId).toBe(entry?.snapshot.subjectId);
    expect(entry?.section).toBe(entry?.snapshot.section);
    expect(entry?.sourceQuery.endpoint).toBe('get-teach-table-show');
  });
});

describe('snapshotToSection', () => {
  it('maps a snapshot to a plain section and drops subject metadata', () => {
    const snapshot = makeSnapshot({ subjectId: '90592033', section: '901' });
    const section = snapshotToSection(snapshot);
    expect(section.subjectId).toBe('90592033');
    expect(section.section).toBe('901');
    expect('subjectMeta' in section).toBe(false);
    expect(section.exam).toEqual({});
  });

  it('carries only the present exam ranges', () => {
    const snapshot = makeSnapshot({
      exam: { final: { start: '2026-10-01T09:00', end: '2026-10-01T12:00' } },
    });
    const section = snapshotToSection(snapshot);
    expect(section.exam.final).toEqual({
      start: '2026-10-01T09:00',
      end: '2026-10-01T12:00',
    });
    expect(section.exam.midterm).toBeUndefined();
  });
});

describe('offeredTo on the snapshot', () => {
  it('parses a snapshot stored before the field existed', () => {
    const snapshot = makeSnapshot();
    expect('offeredTo' in snapshot).toBe(false);
    const plan = makePlan({ entries: [makePlanEntry({ snapshot })] });
    const result = validate(planSchema, plan);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const stored = result.value.entries[0]?.snapshot;
      expect(stored?.offeredTo).toBeUndefined();
      expect(stored && 'offeredTo' in snapshotToSection(stored)).toBe(false);
    }
  });

  it('accepts a snapshot carrying the ids and rejects a malformed item', () => {
    const good = makePlan({
      entries: [
        makePlanEntry({ snapshot: makeSnapshot({ offeredTo: OFFERED }) }),
      ],
    });
    expect(validate(planSchema, good).ok).toBe(true);
    const snapshot = { ...makeSnapshot(), offeredTo: [{ facultyId: '01' }] };
    const bad = { ...makePlan(), entries: [{ ...makePlanEntry(), snapshot }] };
    const result = validate(planSchema, bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.error.issues.some((issue) => issue.path.includes('offeredTo')),
      ).toBe(true);
    }
  });

  it('round trips the list through buildSnapshot and snapshotToSection', () => {
    const snapshot = makeSnapshot({ offeredTo: OFFERED });
    const section = snapshotToSection(snapshot);
    expect(section.offeredTo).toEqual(OFFERED);
    expect(buildSnapshot(section, snapshot.subjectMeta).offeredTo).toEqual(
      OFFERED,
    );
  });

  it('omits the key when the section has no list', () => {
    const section = snapshotToSection(makeSnapshot());
    const snapshot = buildSnapshot(section, makeSnapshot().subjectMeta);
    expect('offeredTo' in snapshot).toBe(false);
  });

  // The extension holds only the storage permission, without unlimitedStorage, so each
  // stored snapshot counts against the storage.local quota. The 22 grouping section is
  // the widest in the captures; ids only keep it near 3.3 KB, and the budget fails the
  // test if names or a verbose shape creep in.
  it('keeps the 22 grouping snapshot of 90641007/101 under a fixed byte budget', () => {
    const SNAPSHOT_BYTE_BUDGET = 4096;
    const OFFERED_ITEM_BYTE_BUDGET = 80;
    const result = normalizeTeachTable(
      loadFixture('teach-table.by_subject_id.capture.json'),
    );
    if (!result.ok) {
      throw new Error('fixture failed to normalize');
    }
    const course = result.value.courses[0];
    const section = course?.sections.find((s) => s.section === '101');
    if (course === undefined || section === undefined) {
      throw new Error('section 90641007/101 not found');
    }
    const snapshot = buildSnapshot(section, {
      subjectId: course.subjectId,
      nameTh: course.nameTh,
      nameEn: course.nameEn,
      credit: course.credit,
      creditStr: course.creditStr,
    });
    expect(snapshot.offeredTo).toHaveLength(22);
    expect(byteLength(snapshot)).toBeLessThan(SNAPSHOT_BYTE_BUDGET);
    expect(byteLength(snapshot.offeredTo)).toBeLessThan(
      22 * OFFERED_ITEM_BYTE_BUDGET,
    );
  });
});
