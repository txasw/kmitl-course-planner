import { describe, it, expect } from 'vitest';
import {
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import {
  meetingsOverlap,
  sectionTimeOverlaps,
  areDeclaredPair,
  isDuplicateSubject,
} from './conflicts';

describe('meetingsOverlap', () => {
  it('reports overlap for intersecting ranges on the same day', () => {
    const a = makeMeeting({ day: 1, startMin: 540, endMin: 660 });
    const b = makeMeeting({ day: 1, startMin: 600, endMin: 720 });
    expect(meetingsOverlap(a, b)).toBe(true);
  });

  it('treats a shared boundary as adjacency, not overlap', () => {
    const a = makeMeeting({ day: 1, startMin: 540, endMin: 600 });
    const b = makeMeeting({ day: 1, startMin: 600, endMin: 660 });
    expect(meetingsOverlap(a, b)).toBe(false);
  });

  it('does not overlap across different days', () => {
    const a = makeMeeting({ day: 1, startMin: 540, endMin: 660 });
    const b = makeMeeting({ day: 2, startMin: 540, endMin: 660 });
    expect(meetingsOverlap(a, b)).toBe(false);
  });
});

describe('sectionTimeOverlaps', () => {
  it('returns the intersected window for each colliding meeting pair', () => {
    const existing = makeSection({
      meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 720 })],
    });
    const incoming = makeSection({
      meetings: [makeMeeting({ day: 3, startMin: 600, endMin: 780 })],
    });
    expect(sectionTimeOverlaps(existing, incoming)).toEqual([
      { day: 3, startMin: 600, endMin: 720 },
    ]);
  });

  it('returns nothing when no meetings collide', () => {
    const existing = makeSection({
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const incoming = makeSection({
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
    });
    expect(sectionTimeOverlaps(existing, incoming)).toEqual([]);
  });
});

describe('areDeclaredPair', () => {
  it('recognises a bidirectional declared pair of one subject', () => {
    const lecture = makeSection({ section: '901', pairedSection: '902' });
    const practice = makeSection({ section: '902', pairedSection: '901' });
    expect(areDeclaredPair(lecture, practice)).toBe(true);
  });

  it('is false across different subjects', () => {
    const a = makeSection({
      subjectId: 'X',
      section: '901',
      pairedSection: '902',
    });
    const b = makeSection({
      subjectId: 'Y',
      section: '902',
      pairedSection: '901',
    });
    expect(areDeclaredPair(a, b)).toBe(false);
  });
});

describe('isDuplicateSubject', () => {
  it('blocks a second, non paired section of the same subject', () => {
    const existing = makeSection({ section: '901', pairedSection: null });
    const incoming = makeSection({ section: '903', pairedSection: null });
    expect(isDuplicateSubject(existing, incoming)).toBe(true);
  });

  it('allows the declared pair of an existing section', () => {
    const existing = makeSection({ section: '901', pairedSection: '902' });
    const incoming = makeSection({ section: '902', pairedSection: '901' });
    expect(isDuplicateSubject(existing, incoming)).toBe(false);
  });

  it('does not flag the same section against itself', () => {
    const existing = makeSection({ section: '901' });
    const incoming = makeSection({ section: '901' });
    expect(isDuplicateSubject(existing, incoming)).toBe(false);
  });

  it('does not flag different subjects', () => {
    const existing = makeSection({ subjectId: 'X', section: '901' });
    const incoming = makeSection({ subjectId: 'Y', section: '901' });
    expect(isDuplicateSubject(existing, incoming)).toBe(false);
  });
});
