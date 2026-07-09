// A placed section reshaped for the timetable: the section's identity and
// meetings plus the subject name and credit the grid, shelf, and footer render.
// The fields are lifted from the plan entry snapshot so the planner never reaches
// back into the transient catalog. An unscheduled section is one with no meetings.

import type { SectionSnapshot, VerifyStatus } from '@/lib/domain/plan';
import type { Meeting, MeetingKind } from '@/lib/domain/types';

export interface PlacedSection {
  teachTableId: string;
  subjectId: string;
  section: string;
  nameTh: string;
  nameEn: string;
  credit: number;
  kind: MeetingKind;
  meetings: Meeting[];
  /** The entry's latest verification state, for the grid and shelf badges. */
  verifyStatus: VerifyStatus;
}

/** Reshape a stored snapshot into the fields the timetable renders. The verification
 * status is carried from the plan entry so the block can badge a changed or missing
 * section; it defaults to unverified for the callers that do not track it. */
export function toPlacedSection(
  snapshot: SectionSnapshot,
  verifyStatus: VerifyStatus = 'unverified',
): PlacedSection {
  return {
    teachTableId: snapshot.teachTableId,
    subjectId: snapshot.subjectId,
    section: snapshot.section,
    nameTh: snapshot.subjectMeta.nameTh,
    nameEn: snapshot.subjectMeta.nameEn,
    credit: snapshot.subjectMeta.credit,
    kind: snapshot.kind,
    meetings: snapshot.meetings,
    verifyStatus,
  };
}

/** Whether a section has at least one scheduled meeting to place on the grid. */
export function isScheduled(section: PlacedSection): boolean {
  return section.meetings.length > 0;
}
