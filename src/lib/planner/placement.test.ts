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

describe('checkPlacement multi-meeting sections', () => {
  // Subject 01476101 section 34 meets twice on the same Thursday (day 4): 08:45 to
  // 10:15 (525 to 615) and 10:30 to 12:00 (630 to 720). Its two periods must never
  // self conflict, and both must guard the plan.
  const multi = makeSection({
    teachTableId: 'm',
    subjectId: '01476101',
    section: '34',
    meetings: [
      makeMeeting({ day: 4, startMin: 525, endMin: 615 }),
      makeMeeting({ day: 4, startMin: 630, endMin: 720 }),
    ],
  });

  it('accepts a section whose own two periods sit on the same day', () => {
    expect(checkPlacement([], [multi])).toEqual({ ok: true });
  });

  it('blocks an add on the second period, proving it reached the engine', () => {
    const incoming = makeSection({
      teachTableId: 'q',
      subjectId: 'Y',
      section: '902',
      meetings: [makeMeeting({ day: 4, startMin: 630, endMin: 720 })],
    });
    const result = checkPlacement([multi], [incoming]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflicts).toEqual([
        {
          kind: 'time',
          blocking: { teachTableId: 'm', subjectId: '01476101', section: '34' },
          day: 4,
          startMin: 630,
          endMin: 720,
        },
      ]);
    }
  });

  it('accepts a meeting in the gap, since adjacency is not a clash', () => {
    // 10:15 to 10:30 (615 to 630) touches the first period's end and the second's
    // start; the half open rule treats both boundaries as adjacency.
    const gap = makeSection({
      teachTableId: 'g',
      subjectId: 'Z',
      section: '903',
      meetings: [makeMeeting({ day: 4, startMin: 615, endMin: 630 })],
    });
    expect(checkPlacement([multi], [gap])).toEqual({ ok: true });
  });
});

describe('checkPlacement exam gate', () => {
  // Two sections on different days never collide in time, so any block here is the exam
  // rule alone. Windows are the API's Gregorian "YYYY-MM-DD HH:MM:SS".
  const placedMid = makeSection({
    teachTableId: 'p',
    subjectId: 'A',
    section: '1',
    meetings: [makeMeeting({ day: 1 })],
    exam: {
      midterm: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
    },
  });
  const incomingMid = makeSection({
    teachTableId: 'i',
    subjectId: 'B',
    section: '2',
    meetings: [makeMeeting({ day: 3 })],
    exam: {
      midterm: { start: '2026-08-21 11:00:00', end: '2026-08-21 13:00:00' },
    },
  });

  it('blocks a midterm that overlaps a placed midterm on another day', () => {
    const result = checkPlacement([placedMid], [incomingMid]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflicts).toHaveLength(1);
      const conflict = result.conflicts[0];
      expect(conflict?.kind).toBe('exam');
      if (conflict?.kind === 'exam') {
        expect(conflict.examKind).toBe('midterm');
        expect(conflict.blocking.subjectId).toBe('A');
        expect(conflict.self).toEqual(incomingMid.exam.midterm);
      }
    }
  });

  it('blocks a final that overlaps a placed final', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'A',
      section: '1',
      meetings: [makeMeeting({ day: 1 })],
      exam: {
        final: { start: '2026-10-30 09:00:00', end: '2026-10-30 12:00:00' },
      },
    });
    const incoming = makeSection({
      teachTableId: 'i',
      subjectId: 'B',
      section: '2',
      meetings: [makeMeeting({ day: 3 })],
      exam: {
        final: { start: '2026-10-30 10:00:00', end: '2026-10-30 11:00:00' },
      },
    });
    const result = checkPlacement([placed], [incoming]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflicts[0]?.kind).toBe('exam');
    }
  });

  it('does not block a midterm against a final on the same datetime', () => {
    const incoming = makeSection({
      teachTableId: 'i',
      subjectId: 'B',
      section: '2',
      meetings: [makeMeeting({ day: 3 })],
      exam: {
        final: { start: '2026-08-21 11:00:00', end: '2026-08-21 13:00:00' },
      },
    });
    expect(checkPlacement([placedMid], [incoming])).toEqual({ ok: true });
  });

  it('treats a touching exam boundary as adjacency, not a clash', () => {
    const incoming = makeSection({
      teachTableId: 'i',
      subjectId: 'B',
      section: '2',
      meetings: [makeMeeting({ day: 3 })],
      exam: {
        midterm: { start: '2026-08-21 12:00:00', end: '2026-08-21 14:00:00' },
      },
    });
    expect(checkPlacement([placedMid], [incoming])).toEqual({ ok: true });
  });

  it('never blocks a declared pair against itself on a shared exam', () => {
    const exam = {
      midterm: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
    };
    const lecture = makeSection({
      teachTableId: 'l',
      subjectId: 'A',
      section: '1',
      pairedSection: '2',
      meetings: [makeMeeting({ day: 1 })],
      exam,
    });
    const practice = makeSection({
      teachTableId: 'pr',
      subjectId: 'A',
      section: '2',
      pairedSection: '1',
      meetings: [makeMeeting({ day: 2 })],
      exam,
    });
    expect(checkPlacement([lecture], [practice])).toEqual({ ok: true });
  });

  it('gates an unscheduled section, since no meeting does not exempt its exam', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'A',
      section: '1',
      meetings: [],
      exam: {
        midterm: { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' },
      },
    });
    const incoming = makeSection({
      teachTableId: 'i',
      subjectId: 'B',
      section: '2',
      meetings: [],
      exam: {
        midterm: { start: '2026-08-21 10:00:00', end: '2026-08-21 11:00:00' },
      },
    });
    const result = checkPlacement([placed], [incoming]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflicts[0]?.kind).toBe('exam');
    }
  });
});
