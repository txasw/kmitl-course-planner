import { describe, it, expect } from 'vitest';
import type { Meeting } from '../domain/types';
import type { PlanEntry, SourceQuery } from '../domain/plan';
import {
  makeCourse,
  makeMeeting,
  makePlanEntry,
  makeSection,
  makeSnapshot,
} from '../../../tests/support/domain-builders';
import { addSectionGroup, planCredits, removeEntry } from './transaction';

const SOURCE_QUERY: SourceQuery = {
  endpoint: 'get-teach-table-show',
  params: { mode: 'by_class' },
};
const NOW = '2026-07-08T00:00:00.000Z';

interface EntryOptions {
  teachTableId: string;
  subjectId: string;
  section: string;
  credit?: number;
  pairedSection?: string | null;
  meetings?: Meeting[];
}

function makeEntry(options: EntryOptions): PlanEntry {
  return makePlanEntry({
    snapshot: makeSnapshot({
      teachTableId: options.teachTableId,
      subjectId: options.subjectId,
      section: options.section,
      pairedSection: options.pairedSection ?? null,
      meetings: options.meetings ?? [makeMeeting()],
      subjectMeta: {
        subjectId: options.subjectId,
        nameTh: 'วิชา',
        nameEn: 'Subject',
        credit: options.credit ?? 3,
        creditStr: '3(3-0-6)',
      },
    }),
  });
}

describe('addSectionGroup', () => {
  it('adds a section to an empty plan', () => {
    const section = makeSection({ teachTableId: 'a', subjectId: 'S1' });
    const course = makeCourse({ subjectId: 'S1', sections: [section] });
    const outcome = addSectionGroup([], course, section, SOURCE_QUERY, NOW);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.added).toHaveLength(1);
      expect(outcome.result.entries).toHaveLength(1);
      expect(outcome.result.entries[0]?.snapshot.subjectMeta.nameTh).toBe(
        makeCourse().nameTh,
      );
    }
  });

  it('adds a lecture and practice pair atomically', () => {
    const lecture = makeSection({
      teachTableId: 'L',
      subjectId: 'S1',
      section: '901',
      pairedSection: '902',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
    });
    const practice = makeSection({
      teachTableId: 'P',
      subjectId: 'S1',
      section: '902',
      kind: 'practice',
      pairedSection: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 720 })],
    });
    const course = makeCourse({
      subjectId: 'S1',
      sections: [lecture, practice],
    });
    const outcome = addSectionGroup([], course, lecture, SOURCE_QUERY, NOW);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.added.map((entry) => entry.teachTableId)).toEqual([
        'L',
        'P',
      ]);
    }
  });

  it('rejects a time conflict and adds nothing', () => {
    const existing = makeEntry({
      teachTableId: 'x',
      subjectId: 'S1',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 720 })],
    });
    const incoming = makeSection({
      teachTableId: 'y',
      subjectId: 'S2',
      section: '901',
      meetings: [makeMeeting({ day: 1, startMin: 600, endMin: 660 })],
    });
    const course = makeCourse({ subjectId: 'S2', sections: [incoming] });
    const outcome = addSectionGroup(
      [existing],
      course,
      incoming,
      SOURCE_QUERY,
      NOW,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.conflicts.some((c) => c.kind === 'time')).toBe(true);
    }
  });

  it('rejects a duplicate subject', () => {
    const existing = makeEntry({
      teachTableId: 'x',
      subjectId: 'S1',
      section: '901',
    });
    const incoming = makeSection({
      teachTableId: 'y',
      subjectId: 'S1',
      section: '902',
      meetings: [makeMeeting({ day: 3 })],
    });
    const course = makeCourse({ subjectId: 'S1', sections: [incoming] });
    const outcome = addSectionGroup(
      [existing],
      course,
      incoming,
      SOURCE_QUERY,
      NOW,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.conflicts.some((c) => c.kind === 'duplicate')).toBe(true);
    }
  });

  it('adds an unscheduled section when no subject duplicates it', () => {
    const online = makeSection({
      teachTableId: 'o',
      subjectId: 'S9',
      section: '1',
      meetings: [],
    });
    const course = makeCourse({ subjectId: 'S9', sections: [online] });
    const outcome = addSectionGroup([], course, online, SOURCE_QUERY, NOW);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.added[0]?.snapshot.meetings).toHaveLength(0);
    }
  });

  it('rejects an unscheduled section that duplicates a placed subject', () => {
    const existing = makeEntry({
      teachTableId: 'x',
      subjectId: 'S9',
      section: '900',
    });
    const online = makeSection({
      teachTableId: 'o',
      subjectId: 'S9',
      section: '1',
      meetings: [],
    });
    const course = makeCourse({ subjectId: 'S9', sections: [online] });
    const outcome = addSectionGroup(
      [existing],
      course,
      online,
      SOURCE_QUERY,
      NOW,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.conflicts[0]?.kind).toBe('duplicate');
    }
  });

  it('adds a mixed pair of a scheduled and an unscheduled half', () => {
    const lecture = makeSection({
      teachTableId: 'L',
      subjectId: 'S1',
      section: '901',
      pairedSection: '902',
      meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 660 })],
    });
    const online = makeSection({
      teachTableId: 'O',
      subjectId: 'S1',
      section: '902',
      kind: 'practice',
      pairedSection: '901',
      meetings: [],
    });
    const course = makeCourse({ subjectId: 'S1', sections: [lecture, online] });
    const outcome = addSectionGroup([], course, lecture, SOURCE_QUERY, NOW);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.added).toHaveLength(2);
      const online902 = outcome.result.added.find(
        (entry) => entry.section === '902',
      );
      expect(online902?.snapshot.meetings).toHaveLength(0);
    }
  });
});

describe('removeEntry', () => {
  it('removes a single section', () => {
    const entry = makeEntry({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    const result = removeEntry([entry], 'a');
    expect(result.entries).toHaveLength(0);
    expect(result.removed).toHaveLength(1);
  });

  it('removes both halves of a pair from either half', () => {
    const lecture = makeEntry({
      teachTableId: 'L',
      subjectId: 'S1',
      section: '901',
      pairedSection: '902',
    });
    const practice = makeEntry({
      teachTableId: 'P',
      subjectId: 'S1',
      section: '902',
      pairedSection: '901',
    });
    const entries = [lecture, practice];
    expect(removeEntry(entries, 'L').entries).toHaveLength(0);
    expect(removeEntry(entries, 'P').entries).toHaveLength(0);
    expect(removeEntry(entries, 'L').removed).toHaveLength(2);
  });

  it('returns the entries unchanged for an unknown id', () => {
    const entry = makeEntry({
      teachTableId: 'a',
      subjectId: 'S1',
      section: '901',
    });
    const result = removeEntry([entry], 'missing');
    expect(result.entries).toHaveLength(1);
    expect(result.removed).toHaveLength(0);
  });
});

describe('planCredits', () => {
  it('counts each subject once and includes unscheduled sections', () => {
    const entries = [
      makeEntry({
        teachTableId: 'a',
        subjectId: 'S1',
        section: '901',
        credit: 3,
      }),
      makeEntry({
        teachTableId: 'b',
        subjectId: 'S1',
        section: '902',
        credit: 3,
        pairedSection: '901',
      }),
      makeEntry({
        teachTableId: 'c',
        subjectId: 'S2',
        section: '1',
        credit: 2,
        meetings: [],
      }),
    ];
    expect(planCredits(entries)).toEqual({ credits: 5, subjects: 2 });
  });
});
