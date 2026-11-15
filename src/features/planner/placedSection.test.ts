import { describe, it, expect } from 'vitest';
import type { Meeting } from '@/lib/domain/types';
import { partitionScheduled, type PlacedSection } from './placedSection';

const MEETING: Meeting = {
  day: 1,
  startMin: 540,
  endMin: 720,
  room: '101',
  building: 'ECC',
  kind: 'lecture',
};

function makePlaced(
  teachTableId: string,
  meetings: Meeting[] = [],
): PlacedSection {
  return {
    teachTableId,
    subjectId: '01006029',
    section: '1',
    nameTh: 'วิชา',
    nameEn: 'Subject',
    credit: 3,
    kind: 'lecture',
    meetings,
    rulesTh: '',
    rulesEn: '',
    remark: '',
    verifyStatus: 'unverified',
  };
}

describe('partitionScheduled', () => {
  it('splits the sections by whether they carry a meeting, keeping plan order', () => {
    const sections = [
      makePlaced('a', [MEETING]),
      makePlaced('b'),
      makePlaced('c', [MEETING]),
      makePlaced('d'),
    ];
    const { scheduled, unscheduled } = partitionScheduled(sections);
    expect(scheduled.map((section) => section.teachTableId)).toEqual([
      'a',
      'c',
    ]);
    expect(unscheduled.map((section) => section.teachTableId)).toEqual([
      'b',
      'd',
    ]);
  });

  it('returns two empty lists for an empty plan', () => {
    expect(partitionScheduled([])).toEqual({ scheduled: [], unscheduled: [] });
  });
});
