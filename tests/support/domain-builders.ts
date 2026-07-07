import type { Course, Meeting, Section } from '../../src/lib/domain/types';

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
