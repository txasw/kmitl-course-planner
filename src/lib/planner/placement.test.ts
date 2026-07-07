import { describe, it, expect } from 'vitest';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { checkPlacement, expandSectionGroup } from './placement';

describe('expandSectionGroup', () => {
  it('returns a standalone section alone', () => {
    const section = makeSection({ pairedSection: null });
    const course = makeCourse({ sections: [section] });
    expect(expandSectionGroup(course, section)).toEqual([section]);
  });

  it('includes the declared pair when it exists in the course', () => {
    const lecture = makeSection({
      teachTableId: 'a',
      section: '901',
      pairedSection: '902',
    });
    const practice = makeSection({
      teachTableId: 'b',
      section: '902',
      pairedSection: '901',
    });
    const course = makeCourse({ sections: [lecture, practice] });
    expect(expandSectionGroup(course, lecture)).toEqual([lecture, practice]);
  });

  it('places a section alone when its pair is absent from the course', () => {
    const section = makeSection({ section: '901', pairedSection: '902' });
    const course = makeCourse({ sections: [section] });
    expect(expandSectionGroup(course, section)).toEqual([section]);
  });
});

describe('checkPlacement', () => {
  it('accepts a group that collides with nothing', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'X',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const incoming = makeSection({
      teachTableId: 'q',
      subjectId: 'Y',
      meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 660 })],
    });
    expect(checkPlacement([placed], [incoming])).toEqual({ ok: true });
  });

  it('reports a time conflict with the blocking entry and range', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'X',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const incoming = makeSection({
      teachTableId: 'q',
      subjectId: 'Y',
      section: '902',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
    });
    const result = checkPlacement([placed], [incoming]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflicts).toEqual([
        {
          kind: 'time',
          blocking: { teachTableId: 'p', subjectId: 'X', section: '901' },
          day: 1,
          startMin: 600,
          endMin: 660,
        },
      ]);
    }
  });

  it('reports a duplicate subject conflict', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'X',
      section: '901',
      meetings: [makeMeeting({ day: 1 })],
    });
    const incoming = makeSection({
      teachTableId: 'q',
      subjectId: 'X',
      section: '903',
      meetings: [makeMeeting({ day: 2 })],
    });
    const result = checkPlacement([placed], [incoming]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflicts).toEqual([
        {
          kind: 'duplicate',
          blocking: { teachTableId: 'p', subjectId: 'X', section: '901' },
          subjectId: 'X',
        },
      ]);
    }
  });

  it('rejects an entire pair when one half conflicts', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'X',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
    });
    const lecture = makeSection({
      teachTableId: 'q',
      subjectId: 'Y',
      section: '801',
      pairedSection: '802',
      meetings: [makeMeeting({ day: 1, startMin: 660, endMin: 780 })],
    });
    const practice = makeSection({
      teachTableId: 'r',
      subjectId: 'Y',
      section: '802',
      pairedSection: '801',
      meetings: [makeMeeting({ day: 2, startMin: 540, endMin: 600 })],
    });
    const result = checkPlacement([placed], [lecture, practice]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        kind: 'time',
        blocking: { teachTableId: 'p' },
      });
    }
  });

  it('allows adding a declared pair half already sharing the subject', () => {
    const placedLecture = makeSection({
      teachTableId: 'a',
      subjectId: 'X',
      section: '901',
      pairedSection: '902',
      meetings: [makeMeeting({ day: 1, startMin: 480, endMin: 600 })],
    });
    const incomingPractice = makeSection({
      teachTableId: 'b',
      subjectId: 'X',
      section: '902',
      pairedSection: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
    });
    expect(checkPlacement([placedLecture], [incomingPractice])).toEqual({
      ok: true,
    });
  });

  it('does not conflict a section against its own placed copy', () => {
    const section = makeSection({ teachTableId: 'p', subjectId: 'X' });
    expect(checkPlacement([section], [section])).toEqual({ ok: true });
  });
});
