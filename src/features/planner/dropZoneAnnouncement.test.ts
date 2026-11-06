import { describe, it, expect } from 'vitest';
import { createTranslator } from '@/lib/i18n/t';
import {
  makeCourse,
  makeMeeting,
  makeSection,
} from '../../../tests/support/domain-builders';
import { createDragStore } from './dragStore';
import { dropZoneAnnouncement } from './dropZoneAnnouncement';

const t = createTranslator('en');

const monday = makeSection({
  teachTableId: 'a',
  subjectId: 'S1',
  section: '901',
  meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
});
const wednesday = makeSection({
  teachTableId: 'b',
  subjectId: 'S1',
  section: '902',
  meetings: [makeMeeting({ day: 3, startMin: 540, endMin: 600 })],
});
const clash = makeSection({
  teachTableId: 'p',
  subjectId: 'OTHER',
  meetings: [makeMeeting({ day: 1, startMin: 540, endMin: 600 })],
});
const course = makeCourse({ subjectId: 'S1', sections: [monday, wednesday] });

describe('dropZoneAnnouncement', () => {
  it('says nothing while no drag is live', () => {
    expect(dropZoneAnnouncement(createDragStore().getState(), t)).toBeNull();
  });

  it('names the timetable for a valid section drag', () => {
    const store = createDragStore();
    store.getState().start(course, monday, []);
    expect(dropZoneAnnouncement(store.getState(), t)).toBe(
      'Drop on the timetable to add',
    );
  });

  it('names the swap targets for a blocked section drag', () => {
    const store = createDragStore();
    store.getState().start(course, monday, [clash]);
    expect(dropZoneAnnouncement(store.getState(), t)).toBe(
      'This section conflicts with the plan, so drop on a conflicting block to swap sections',
    );
  });

  it('names the highlighted slots for a course drag', () => {
    const store = createDragStore();
    store.getState().startCourse(course, []);
    expect(dropZoneAnnouncement(store.getState(), t)).toBe(
      'Drop on a highlighted slot to add a section',
    );
  });

  it('names the remove zone, the move slots and the origin for a block drag', () => {
    const store = createDragStore();
    store.getState().startBlockMove(monday, [monday], course);
    expect(dropZoneAnnouncement(store.getState(), t)).toBe(
      'Drop on the remove zone to remove, on a highlighted slot to move, or back in place to cancel',
    );
  });

  it('leaves out the move slots when the subject is not in the catalog', () => {
    const store = createDragStore();
    store.getState().startBlockMove(monday, [monday], null);
    expect(dropZoneAnnouncement(store.getState(), t)).toBe(
      'Drop on the remove zone to remove, or back in place to cancel',
    );
  });
});
