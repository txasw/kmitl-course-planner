import { describe, it, expect } from 'vitest';
import { makeSection } from '../../../tests/support/domain-builders';
import {
  addedExamWarnings,
  examWindowsOverlap,
  planExamWarnings,
  sectionExamOverlaps,
} from './examOverlap';

const MID_A = { start: '2026-08-21 09:00:00', end: '2026-08-21 12:00:00' };
const MID_A_OVERLAP = {
  start: '2026-08-21 11:00:00',
  end: '2026-08-21 13:00:00',
};
const MID_A_ADJACENT = {
  start: '2026-08-21 12:00:00',
  end: '2026-08-21 14:00:00',
};
const MID_A_DISJOINT = {
  start: '2026-08-22 09:00:00',
  end: '2026-08-22 12:00:00',
};
const FIN_A = { start: '2026-10-30 09:00:00', end: '2026-10-30 12:00:00' };
const FIN_A_OVERLAP = {
  start: '2026-10-30 10:00:00',
  end: '2026-10-30 13:00:00',
};

describe('examWindowsOverlap', () => {
  it('is true when two windows intersect', () => {
    expect(examWindowsOverlap(MID_A, MID_A_OVERLAP)).toBe(true);
  });

  it('is false for adjacent windows where one ends as the other starts', () => {
    expect(examWindowsOverlap(MID_A, MID_A_ADJACENT)).toBe(false);
  });

  it('is false for disjoint windows on different days', () => {
    expect(examWindowsOverlap(MID_A, MID_A_DISJOINT)).toBe(false);
  });

  it('is false when either window is absent', () => {
    expect(examWindowsOverlap(undefined, MID_A)).toBe(false);
    expect(examWindowsOverlap(MID_A, undefined)).toBe(false);
  });

  it('is false when a datetime is malformed and cannot be ordered', () => {
    expect(
      examWindowsOverlap({ start: 'not a date', end: 'also not' }, MID_A),
    ).toBe(false);
  });

  it('is false when a window is not ordered start before end', () => {
    expect(
      examWindowsOverlap(
        { start: '2026-08-21 12:00:00', end: '2026-08-21 09:00:00' },
        MID_A_OVERLAP,
      ),
    ).toBe(false);
  });
});

describe('sectionExamOverlaps', () => {
  it('reports a midterm against a midterm and carries both windows', () => {
    const existing = makeSection({
      teachTableId: 'a',
      exam: { midterm: MID_A },
    });
    const incoming = makeSection({
      teachTableId: 'b',
      exam: { midterm: MID_A_OVERLAP },
    });
    const overlaps = sectionExamOverlaps(existing, incoming);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]?.kind).toBe('midterm');
    expect(overlaps[0]?.blocking.teachTableId).toBe('a');
    expect(overlaps[0]?.self).toEqual(MID_A_OVERLAP);
    expect(overlaps[0]?.other).toEqual(MID_A);
  });

  it('never compares a midterm against a final', () => {
    const existing = makeSection({ exam: { midterm: MID_A } });
    const incoming = makeSection({ exam: { final: MID_A_OVERLAP } });
    expect(sectionExamOverlaps(existing, incoming)).toHaveLength(0);
  });

  it('reports both a midterm and a final clash independently', () => {
    const existing = makeSection({ exam: { midterm: MID_A, final: FIN_A } });
    const incoming = makeSection({
      exam: { midterm: MID_A_OVERLAP, final: FIN_A_OVERLAP },
    });
    expect(sectionExamOverlaps(existing, incoming).map((o) => o.kind)).toEqual([
      'midterm',
      'final',
    ]);
  });
});

describe('planExamWarnings', () => {
  it('reports an exam overlap on both sections', () => {
    const a = makeSection({
      teachTableId: 'a',
      subjectId: 'S1',
      exam: { midterm: MID_A },
    });
    const b = makeSection({
      teachTableId: 'b',
      subjectId: 'S2',
      exam: { midterm: MID_A_OVERLAP },
    });
    const map = planExamWarnings([a, b]);
    expect(map.get('a')?.[0]?.blocking.teachTableId).toBe('b');
    expect(map.get('b')?.[0]?.blocking.teachTableId).toBe('a');
  });

  it('does not flag a declared pair that shares an exam window', () => {
    const lecture = makeSection({
      teachTableId: 'L',
      subjectId: 'S1',
      section: '901',
      pairedSection: '902',
      exam: { midterm: MID_A },
    });
    const practice = makeSection({
      teachTableId: 'P',
      subjectId: 'S1',
      section: '902',
      pairedSection: '901',
      exam: { midterm: MID_A },
    });
    expect(planExamWarnings([lecture, practice]).size).toBe(0);
  });

  it('is empty when no exams overlap', () => {
    const a = makeSection({ teachTableId: 'a', exam: { midterm: MID_A } });
    const b = makeSection({
      teachTableId: 'b',
      exam: { midterm: MID_A_DISJOINT },
    });
    expect(planExamWarnings([a, b]).size).toBe(0);
  });

  it('is empty when sections carry no exam datetimes', () => {
    const a = makeSection({ teachTableId: 'a' });
    const b = makeSection({ teachTableId: 'b', subjectId: 'S2' });
    expect(planExamWarnings([a, b]).size).toBe(0);
  });
});

describe('addedExamWarnings', () => {
  it('reports an added section overlapping a placed one', () => {
    const placed = makeSection({
      teachTableId: 'p',
      subjectId: 'S1',
      exam: { midterm: MID_A },
    });
    const added = makeSection({
      teachTableId: 'n',
      subjectId: 'S2',
      exam: { midterm: MID_A_OVERLAP },
    });
    const overlaps = addedExamWarnings([placed, added], [added]);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]?.blocking.teachTableId).toBe('p');
  });

  it('does not warn a pair against itself when both halves are added', () => {
    const lecture = makeSection({
      teachTableId: 'L',
      subjectId: 'S1',
      section: '901',
      pairedSection: '902',
      exam: { midterm: MID_A },
    });
    const practice = makeSection({
      teachTableId: 'P',
      subjectId: 'S1',
      section: '902',
      pairedSection: '901',
      exam: { midterm: MID_A },
    });
    expect(
      addedExamWarnings([lecture, practice], [lecture, practice]),
    ).toHaveLength(0);
  });
});
