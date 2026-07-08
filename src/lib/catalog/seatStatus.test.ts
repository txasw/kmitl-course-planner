import { describe, expect, it } from 'vitest';
import { makeSection } from '../../../tests/support/domain-builders';
import { computeSeatStatus, isSelectable } from './seatStatus';

describe('computeSeatStatus', () => {
  it('reports open with the free seats for a capped section', () => {
    const section = makeSection({
      seats: { limit: 40, preCount: 5, queueLeft: 12, enrolled: 28 },
    });
    expect(computeSeatStatus(section)).toEqual({ kind: 'open', remaining: 12 });
  });

  it('reports open regardless of queue_left, using limit minus enrolled', () => {
    // queue_left is a waitlist metric, not remaining seats, so a section with
    // free seats and queue_left 0 is still open.
    const section = makeSection({
      seats: { limit: 85, preCount: 0, queueLeft: 0, enrolled: 0 },
    });
    expect(computeSeatStatus(section)).toEqual({ kind: 'open', remaining: 85 });
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

  it('reports full when enrolled reaches the limit', () => {
    const section = makeSection({
      seats: { limit: 40, preCount: 40, queueLeft: 5, enrolled: 40 },
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
