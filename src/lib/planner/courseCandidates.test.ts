import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { courseCandidates } from './courseCandidates';

describe('courseCandidates', () => {
  it('marks an open fitting section as a valid candidate', () => {
    const section = makeSection({ teachTableId: 'a', section: '901' });
    const course = makeCourse({ sections: [section] });
    const [candidate] = courseCandidates(course, []);
    expect(candidate?.valid).toBe(true);
    expect(candidate?.reason).toBe('ok');
  });

  it('marks a full section as a blocked candidate with the seat reason', () => {
    const section = makeSection({
      teachTableId: 'a',
      section: '901',
      seats: { limit: 40, preCount: 40, queueLeft: 0, enrolled: 'full' },
    });
    const course = makeCourse({ sections: [section] });
    expect(courseCandidates(course, [])[0]).toMatchObject({
      valid: false,
      reason: 'full',
    });
  });

  it('marks a closed section as a blocked candidate', () => {
    const section = makeSection({
      teachTableId: 'a',
      section: '901',
      isClosed: true,
    });
    const course = makeCourse({ sections: [section] });
    expect(courseCandidates(course, [])[0]?.reason).toBe('closed');
  });

  it('marks a time conflicting section as a blocked candidate', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'OTHER',
      section: '900',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    const section = makeSection({
      teachTableId: 'a',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
    });
    const course = makeCourse({ sections: [section] });
    expect(courseCandidates(course, [placed])[0]).toMatchObject({
      valid: false,
      reason: 'conflict',
    });
  });

  it('marks a duplicate subject section as a blocked candidate', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'S1',
      section: '900',
    });
    const section = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 3 })],
    });
    const course = makeCourse({ subjectId: 'S1', sections: [section] });
    expect(courseCandidates(course, [placed])[0]?.reason).toBe('duplicate');
  });

  it('excludes an already placed section and expands a pair', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'S1',
      section: '901',
    });
    const lecture = makeSection({
      teachTableId: 'L',
      subjectId: 'S1',
      section: '902',
      pairedSection: '903',
      meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 600 })],
    });
    const practice = makeSection({
      teachTableId: 'P',
      subjectId: 'S1',
      section: '903',
      pairedSection: '902',
      meetings: [makeMeeting({ day: 2, startMin: 600, endMin: 660 })],
    });
    const course = makeCourse({
      subjectId: 'S1',
      sections: [placed, lecture, practice],
    });
    const candidates = courseCandidates(course, [placed]);
    // The placed 901 is excluded; 902 and 903 remain.
    expect(candidates.map((candidate) => candidate.section.section)).toEqual([
      '902',
      '903',
    ]);
    const pair = candidates.find((c) => c.section.section === '902');
    expect(pair?.group).toHaveLength(2);
  });

  it('treats an excluded section as free so its slot becomes a candidate', () => {
    // A block move: 901 is placed but being dragged, so it is excluded. It must not
    // reappear as a self candidate, and 902 must read as free rather than a duplicate.
    const dragged = makeSection({
      teachTableId: 'd',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const target = makeSection({
      teachTableId: 't',
      subjectId: 'S1',
      section: '902',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const course = makeCourse({ subjectId: 'S1', sections: [dragged, target] });
    const candidates = courseCandidates(course, [dragged], new Set(['S1:901']));
    expect(candidates.map((candidate) => candidate.section.section)).toEqual([
      '902',
    ]);
    expect(candidates[0]?.valid).toBe(true);
  });
});
