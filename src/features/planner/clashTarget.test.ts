import { describe, it, expect } from 'vitest';
import type { Meeting } from '@/lib/domain/types';
import {
  makeMeeting,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { firstClash } from './clashTarget';
import { toPlacedSection, type PlacedSection } from './placedSection';

function placed(teachTableId: string, meetings: Meeting[]): PlacedSection {
  return toPlacedSection(makeSnapshot({ teachTableId, meetings }));
}

describe('firstClash', () => {
  it('picks the clashing section whose meeting comes first in the week', () => {
    const sections = [
      placed('late', [makeMeeting({ day: 3, startMin: 660, endMin: 720 })]),
      placed('free', [makeMeeting({ day: 1, startMin: 480, endMin: 540 })]),
      placed('early', [
        makeMeeting({ day: 5, startMin: 480, endMin: 540 }),
        makeMeeting({ day: 3, startMin: 600, endMin: 720 }),
      ]),
    ];
    expect(firstClash(sections, new Set(['late', 'early']))).toEqual({
      teachTableId: 'early',
      day: 3,
    });
  });

  it('orders Sunday before Monday, as the grid rows do', () => {
    const sections = [
      placed('mon', [makeMeeting({ day: 1, startMin: 480, endMin: 540 })]),
      placed('sun', [makeMeeting({ day: 0, startMin: 900, endMin: 960 })]),
    ];
    expect(firstClash(sections, new Set(['mon', 'sun']))?.day).toBe(0);
  });

  it('prefers a section that meets over one with no meeting', () => {
    const sections = [
      placed('online', []),
      placed('thu', [makeMeeting({ day: 4, startMin: 480, endMin: 540 })]),
    ];
    expect(firstClash(sections, new Set(['online', 'thu']))).toEqual({
      teachTableId: 'thu',
      day: 4,
    });
  });

  it('falls back to the first listed section with no meeting', () => {
    const sections = [placed('x', []), placed('y', []), placed('z', [])];
    expect(firstClash(sections, new Set(['z', 'y']))).toEqual({
      teachTableId: 'y',
      day: null,
    });
  });

  it('returns null when no section clashes', () => {
    const sections = [
      placed('a', [makeMeeting({ day: 1, startMin: 480, endMin: 540 })]),
    ];
    expect(firstClash(sections, new Set())).toBeNull();
  });
});
