import type { Course, Meeting, Section } from '../../src/lib/domain/types';
import type {
  Plan,
  PlanEntry,
  SectionSnapshot,
} from '../../src/lib/domain/plan';

/** Build a Meeting with sensible defaults, overriding any field per test. */
export function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    day: 1,
    startMin: 540,
    endMin: 720,
    room: 'A101',
    building: 'A',
    kind: 'lecture',
    ...overrides,
  };
}

/** Build a Section with one default meeting, overriding any field per test. */
export function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    teachTableId: 't1',
    subjectId: '90000001',
    section: '901',
    kind: 'lecture',
    pairedSection: null,
    meetings: [makeMeeting()],
    teachersTh: [],
    teachersEn: [],
    seats: { limit: 40, preCount: 0, queueLeft: 40, enrolled: 0 },
    isClosed: false,
    exam: {},
    rulesTh: '',
    rulesEn: '',
    remark: '',
    ...overrides,
  };
}

/** Build a Course with one default section, overriding any field per test. */
export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    subjectId: '90000001',
    nameTh: 'วิชา',
    nameEn: 'Subject',
    credit: 3,
    creditStr: '3(3-0-6)',
    groupNameTh: 'กลุ่ม 1',
    groupNameEn: 'Group 1',
    sections: [makeSection()],
    ...overrides,
  };
}

/** Build a section snapshot (a Section plus subject metadata) for a plan entry. */
export function makeSnapshot(
  overrides: Partial<SectionSnapshot> = {},
): SectionSnapshot {
  const section = makeSection();
  return {
    ...section,
    subjectMeta: {
      subjectId: section.subjectId,
      nameTh: 'วิชา',
      nameEn: 'Subject',
      credit: 3,
      creditStr: '3(3-0-6)',
    },
    ...overrides,
  };
}

/** Build a plan entry whose durable identity mirrors its snapshot by default. */
export function makePlanEntry(overrides: Partial<PlanEntry> = {}): PlanEntry {
  const snapshot = overrides.snapshot ?? makeSnapshot();
  return {
    teachTableId: snapshot.teachTableId,
    subjectId: snapshot.subjectId,
    section: snapshot.section,
    addedAt: '2026-07-07T00:00:00.000Z',
    lastVerifiedAt: null,
    verifyStatus: 'unverified',
    sourceQuery: {
      endpoint: 'get-teach-table-show',
      params: { mode: 'by_class' },
    },
    snapshot,
    ...overrides,
  };
}

/** Build a Plan with one default entry, overriding any field per test. */
export function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    name: 'ตาราง 1/2569',
    year: '2569',
    semester: '1',
    entries: [makePlanEntry()],
    createdAt: '2026-07-07T00:00:00.000Z',
    updatedAt: '2026-07-07T00:00:00.000Z',
    ...overrides,
  };
}
