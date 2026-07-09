import { describe, it, expect } from 'vitest';
import type { Plan } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';
import {
  defaultPlanName,
  duplicatePlanOf,
  makePlan,
  mostRecentlyUpdated,
  replaceEntries,
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
    const entry = { teachTableId: 't' } as unknown as Plan['entries'][number];
    const next = replaceEntries(
      [a, b],
      'a',
      [entry],
      '2026-02-02T00:00:00.000Z',
    );
    expect(next[0]?.entries).toHaveLength(1);
    expect(next[0]?.updatedAt).toBe('2026-02-02T00:00:00.000Z');
    expect(next[1]).toBe(b);
  });

  it('duplicates a plan with copied entries and fresh timestamps', () => {
    const entry = { teachTableId: 't' } as unknown as Plan['entries'][number];
    const source: Plan = {
      ...plan('a', '2026-01-01T00:00:00.000Z'),
      entries: [entry],
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
    expect(copy.entries[0]).not.toBe(entry);
  });
});
