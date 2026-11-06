import { describe, it, expect } from 'vitest';
import type { EntryReview, Plan, PlanEntry } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';
import {
  makePlanEntry,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import {
  acknowledgeEntry,
  defaultPlanName,
  markReviewsNotified,
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

describe('acknowledgeEntry', () => {
  const review: EntryReview = {
    kinds: ['exam_changed'],
    before: makeSnapshot(),
    detectedAt: '2026-11-01T00:00:00.000Z',
    notifiedAt: '2026-11-01T00:05:00.000Z',
  };

  it('clears the review and marks a changed entry verified', () => {
    const changed = makePlanEntry({ verifyStatus: 'changed', review });
    const [acknowledged] = acknowledgeEntry([changed], changed.teachTableId);
    expect(acknowledged?.verifyStatus).toBe('verified');
    expect(acknowledged).not.toHaveProperty('review');
  });

  it('clears the review of a missing entry but keeps it missing', () => {
    const missing = makePlanEntry({
      verifyStatus: 'missing',
      review: { ...review, kinds: ['missing'] },
    });
    const [acknowledged] = acknowledgeEntry([missing], missing.teachTableId);
    expect(acknowledged?.verifyStatus).toBe('missing');
    expect(acknowledged).not.toHaveProperty('review');
  });

  it('leaves every other entry untouched', () => {
    const target = makePlanEntry({ verifyStatus: 'changed', review });
    const other = makePlanEntry({
      snapshot: makeSnapshot({ teachTableId: 't2', subjectId: '90000002' }),
      verifyStatus: 'changed',
      review,
    });
    const [, untouched] = acknowledgeEntry(
      [target, other],
      target.teachTableId,
    );
    expect(untouched).toBe(other);
  });
});

describe('markReviewsNotified', () => {
  const review: EntryReview = {
    kinds: ['time_changed'],
    before: makeSnapshot(),
    detectedAt: '2026-11-01T00:00:00.000Z',
    notifiedAt: null,
  };
  const NOW = '2026-11-06T08:00:00.000Z';

  it('stamps the open review of a listed entry and keeps its kinds', () => {
    const changed = makePlanEntry({ verifyStatus: 'changed', review });
    const [marked] = markReviewsNotified(
      [changed],
      new Set([changed.teachTableId]),
      NOW,
    );
    expect(marked?.review).toEqual({ ...review, notifiedAt: NOW });
    expect(marked?.verifyStatus).toBe('changed');
  });

  it('leaves an unlisted, unreviewed, or already shown entry as is', () => {
    const shown = makePlanEntry({
      verifyStatus: 'changed',
      review: { ...review, notifiedAt: '2026-11-02T00:00:00.000Z' },
    });
    const plain = makePlanEntry({
      snapshot: makeSnapshot({ teachTableId: 't2', subjectId: '90000002' }),
    });
    const other = makePlanEntry({
      snapshot: makeSnapshot({ teachTableId: 't3', subjectId: '90000003' }),
      verifyStatus: 'changed',
      review,
    });
    const result = markReviewsNotified(
      [shown, plain, other],
      new Set([shown.teachTableId, 't2']),
      NOW,
    );
    expect(result[0]).toBe(shown);
    expect(result[1]).toBe(plain);
    expect(result[2]).toBe(other);
  });
});
