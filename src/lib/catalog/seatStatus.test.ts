import { describe, expect, it } from 'vitest';
import { makeSection } from '../../../tests/support/domain-builders';
import { computeSeatStatus, isSelectable } from './seatStatus';

describe('computeSeatStatus', () => {
  it('reports open with the remaining queue for a capped section', () => {
    const section = makeSection({
      seats: { limit: 40, preCount: 5, queueLeft: 12, enrolled: 28 },
    });
    expect(computeSeatStatus(section)).toEqual({ kind: 'open', remaining: 12 });
  });

  it('reports open with no count for an uncapped section', () => {
    const section = makeSection({
      seats: { limit: null, preCount: 5, queueLeft: 0, enrolled: 5 },
    });
    expect(computeSeatStatus(section)).toEqual({
      kind: 'open',
      remaining: null,
    });
  });

  it('reports full for the full sentinel', () => {
    const section = makeSection({
      seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
    });
    expect(computeSeatStatus(section)).toEqual({ kind: 'full' });
  });

  it('reports full for a capped section with no queue left', () => {
    const section = makeSection({
      seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 40 },
    });
    expect(computeSeatStatus(section)).toEqual({ kind: 'full' });
  });

  it('reports closed before anything else', () => {
    const section = makeSection({
      isClosed: true,
      seats: { limit: 40, preCount: 0, queueLeft: 40, enrolled: 0 },
    });
    expect(computeSeatStatus(section)).toEqual({ kind: 'closed' });
  });

  it('marks only open sections as selectable', () => {
    expect(isSelectable(makeSection())).toBe(true);
    expect(isSelectable(makeSection({ isClosed: true }))).toBe(false);
  });
});
