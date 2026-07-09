import { describe, it, expect } from 'vitest';
import {
  makePlan,
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { validate } from './schemas';
import { planSchema, snapshotToSection } from './plan';

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
