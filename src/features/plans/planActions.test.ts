import { describe, it, expect } from 'vitest';
import type { Plan, PlanEntry } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';
import {
  defaultPlanName,
  duplicatePlanOf,
  importedPlan,
  makePlan,
  mostRecentlyUpdated,
  replaceEntries,
  uniquePlanName,
} from './planActions';

const TERM: Term = { year: '2569', semester: '1' };

function plan(id: string, updatedAt: string): Plan {
  return {
    id,
    name: id,
    year: '2569',
    semester: '1',
    entries: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

function entry(
  subjectId: string,
  section: string,
  overrides: Partial<PlanEntry> = {},
): PlanEntry {
  return {
    teachTableId: `${subjectId}-${section}`,
    subjectId,
    section,
    addedAt: '2026-01-01T00:00:00.000Z',
    lastVerifiedAt: '2026-01-01T00:00:00.000Z',
    verifyStatus: 'verified',
    ...overrides,
  } as unknown as PlanEntry;
}

function named(id: string, name: string): Plan {
  return { ...plan(id, '2026-01-01T00:00:00.000Z'), name };
}

describe('planActions', () => {
  it('makes an empty plan for a term with matching timestamps', () => {
    const created = makePlan('id', 'ตาราง', TERM, '2026-01-01T00:00:00.000Z');
    expect(created).toMatchObject({
      id: 'id',
      name: 'ตาราง',
      year: '2569',
      semester: '1',
      entries: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('builds the default plan name from the term', () => {
    expect(defaultPlanName({ year: '2569', semester: '2' })).toBe(
      'ตาราง 2/2569',
    );
  });

  it('picks the most recently updated plan by ISO timestamp', () => {
    const older = plan('old', '2026-01-01T00:00:00.001Z');
    const newer = plan('new', '2026-01-02T00:00:00.000Z');
    expect(mostRecentlyUpdated([older, newer])?.id).toBe('new');
    expect(mostRecentlyUpdated([])).toBeNull();
  });

  it('replaces only the target plan entries and stamps updatedAt', () => {
    const a = plan('a', '2026-01-01T00:00:00.000Z');
    const b = plan('b', '2026-01-01T00:00:00.000Z');
    const one = { teachTableId: 't' } as unknown as PlanEntry;
    const next = replaceEntries([a, b], 'a', [one], '2026-02-02T00:00:00.000Z');
    expect(next[0]?.entries).toHaveLength(1);
    expect(next[0]?.updatedAt).toBe('2026-02-02T00:00:00.000Z');
    expect(next[1]).toBe(b);
  });

  it('duplicates a plan with copied entries and fresh timestamps', () => {
    const dupEntry = { teachTableId: 't' } as unknown as PlanEntry;
    const source: Plan = {
      ...plan('a', '2026-01-01T00:00:00.000Z'),
      entries: [dupEntry],
    };
    const copy = duplicatePlanOf(
      source,
      'b',
      'copy',
      '2026-03-03T00:00:00.000Z',
    );
    expect(copy.id).toBe('b');
    expect(copy.name).toBe('copy');
    expect(copy.createdAt).toBe('2026-03-03T00:00:00.000Z');
    expect(copy.entries).toHaveLength(1);
    expect(copy.entries[0]).not.toBe(dupEntry);
  });

  it('imports a plan under a fresh id with every entry reset to unverified', () => {
    const source: Plan = {
      ...plan('orig', '2026-01-01T00:00:00.000Z'),
      entries: [entry('90592008', '901')],
    };
    const result = importedPlan(
      source,
      'fresh',
      'ตาราง (2)',
      '2026-05-05T00:00:00.000Z',
    );
    expect(result.id).toBe('fresh');
    expect(result.name).toBe('ตาราง (2)');
    expect(result.createdAt).toBe('2026-05-05T00:00:00.000Z');
    expect(result.updatedAt).toBe('2026-05-05T00:00:00.000Z');
    expect(result.entries[0]?.verifyStatus).toBe('unverified');
    expect(result.entries[0]?.lastVerifiedAt).toBeNull();
  });

  it('drops entries that share a durable identity on import', () => {
    const source: Plan = {
      ...plan('orig', '2026-01-01T00:00:00.000Z'),
      entries: [
        entry('90592008', '901'),
        entry('90592008', '901'),
        entry('90592033', '902'),
      ],
    };
    const result = importedPlan(
      source,
      'fresh',
      'n',
      '2026-05-05T00:00:00.000Z',
    );
    expect(result.entries).toHaveLength(2);
  });

  it('keeps a plan name that does not collide', () => {
    expect(uniquePlanName('Fall', [named('a', 'Spring')])).toBe('Fall');
  });

  it('suffixes a colliding plan name and increments past existing suffixes', () => {
    expect(uniquePlanName('Fall', [named('a', 'Fall')])).toBe('Fall (2)');
    expect(
      uniquePlanName('Fall', [named('a', 'Fall'), named('b', 'Fall (2)')]),
    ).toBe('Fall (3)');
  });
});
