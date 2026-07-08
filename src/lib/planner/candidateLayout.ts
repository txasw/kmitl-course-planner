// Lay out the course drag candidate footprints on the grid. Each candidate paints
// every meeting of its group as a footprint. When two candidates fall on the same
// cell their footprints must not sit exactly on top of each other, so each one
// carries a stack index counting how many earlier footprints it overlaps; the grid
// offsets by that index so overlapping slots fan out and stay legible.

import type { Meeting } from '../domain/types';
import type { Candidate } from './courseCandidates';
import { meetingColumns, type GridWindow } from './grid';

export interface CandidateFootprint {
  candidate: Candidate;
  meeting: Meeting;
  /** How many earlier footprints overlap this cell; drives the stack offset. */
  stack: number;
}

function overlaps(
  a: { day: number; startQ: number; endQ: number },
  day: number,
  startQ: number,
  endQ: number,
): boolean {
  return a.day === day && a.startQ < endQ && startQ < a.endQ;
}

/** Flatten candidates into positioned footprints with an overlap stack index. */
export function candidateFootprints(
  candidates: Candidate[],
  window: GridWindow,
): CandidateFootprint[] {
  const placed: { day: number; startQ: number; endQ: number }[] = [];
  const footprints: CandidateFootprint[] = [];
  for (const candidate of candidates) {
    const meetings = candidate.group.flatMap((section) => section.meetings);
    for (const meeting of meetings) {
      const { startQuarter, endQuarter } = meetingColumns(
        meeting.startMin,
        meeting.endMin,
        window,
      );
      const stack = placed.filter((cell) =>
        overlaps(cell, meeting.day, startQuarter, endQuarter),
      ).length;
      footprints.push({ candidate, meeting, stack });
      placed.push({ day: meeting.day, startQ: startQuarter, endQ: endQuarter });
    }
  }
  return footprints;
}
