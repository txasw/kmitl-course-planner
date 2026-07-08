import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { DEFAULT_WINDOW } from './grid';
import type { Candidate } from './courseCandidates';
import { candidateFootprints } from './candidateLayout';

function candidate(
  section: string,
  meeting: ReturnType<typeof makeMeeting>,
): Candidate {
  const s = makeSection({
    teachTableId: section,
    section,
    meetings: [meeting],
  });
  return { section: s, group: [s], valid: true, reason: 'ok' };
}

describe('candidateFootprints', () => {
  it('flattens a candidate group into one footprint per meeting', () => {
    const lecture = makeSection({
      teachTableId: 'L',
      section: '901',
      meetings: [
        makeMeeting({ day: 1, startMin: 540, endMin: 600 }),
        makeMeeting({ day: 3, startMin: 540, endMin: 600 }),
      ],
    });
    const candidates: Candidate[] = [
      { section: lecture, group: [lecture], valid: true, reason: 'ok' },
    ];
    expect(candidateFootprints(candidates, DEFAULT_WINDOW)).toHaveLength(2);
  });

  it('stacks overlapping footprints with increasing offset', () => {
    const slot = () => makeMeeting({ day: 1, startMin: 540, endMin: 660 });
    const footprints = candidateFootprints(
      [
        candidate('901', slot()),
        candidate('902', slot()),
        candidate('903', slot()),
      ],
      DEFAULT_WINDOW,
    );
    expect(footprints.map((footprint) => footprint.stack)).toEqual([0, 1, 2]);
  });

  it('does not stack footprints on different days', () => {
    const footprints = candidateFootprints(
      [
        candidate('901', makeMeeting({ day: 1, startMin: 540, endMin: 660 })),
        candidate('902', makeMeeting({ day: 2, startMin: 540, endMin: 660 })),
      ],
      DEFAULT_WINDOW,
    );
    expect(footprints.map((footprint) => footprint.stack)).toEqual([0, 0]);
  });
});
