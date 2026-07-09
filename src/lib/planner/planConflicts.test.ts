import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { planConflicts } from './planConflicts';

describe('planConflicts', () => {
  it('reports a time overlap on both sections', () => {
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
    });
    const map = planConflicts([a, b]);
    expect(map.get('a')?.[0]?.blocking.teachTableId).toBe('b');
    expect(map.get('b')?.[0]?.blocking.teachTableId).toBe('a');
  });

  it('does not flag a declared lecture and practice pair that overlaps', () => {
    const lecture = makeSection({
      teachTableId: 'L',
      subjectId: 'S1',
      section: '901',
      pairedSection: '902',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const practice = makeSection({
      teachTableId: 'P',
      subjectId: 'S1',
      section: '902',
      pairedSection: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
    });
    expect(planConflicts([lecture, practice]).size).toBe(0);
  });

  it('does not flag adjacent meetings where end equals start', () => {
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
    });
    expect(planConflicts([a, b]).size).toBe(0);
  });

  it('does not flag meetings on different days', () => {
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1 })],
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 2 })],
    });
    expect(planConflicts([a, b]).size).toBe(0);
  });
});
