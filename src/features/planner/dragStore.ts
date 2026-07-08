// The drag session state. Validation runs once when a drag starts, because every
// section has a fixed footprint, and the result holds for the whole drag: the grid
// ghosts and the reason chip read it without recomputing per frame. A rejected
// drop moves the active drag into a blocked feedback the strip renders with its
// reason and alternatives. A hover, from a focused grip or a hovered row, previews
// the target cells at low emphasis without arming a drag, and an announcement
// carries a keyboard outcome to the strip's live region. It is a singleton store so
// the grid, the chip, and the strip read it without threading props through the
// drag context.

import { createStore } from 'zustand/vanilla';
import type { Course, Section } from '@/lib/domain/types';
import {
  checkPlacement,
  expandSectionGroup,
  type ConflictDetail,
  type PlacementResult,
} from '@/lib/planner/placement';
import {
  courseCandidates,
  type Candidate,
} from '@/lib/planner/courseCandidates';

export interface ActiveDrag {
  course: Course;
  section: Section;
  /** The section and its declared pair, validated as one atomic group. */
  group: Section[];
  placement: PlacementResult;
}

export interface BlockedFeedback {
  course: Course;
  section: Section;
  conflicts: ConflictDetail[];
}

export interface CourseDrag {
  course: Course;
  candidates: Candidate[];
}

export interface DragStore {
  active: ActiveDrag | null;
  blocked: BlockedFeedback | null;
  /** The section whose cells are previewed at low emphasis, or null. */
  hover: Section | null;
  /** A resolved message for the strip's live region after a keyboard outcome. */
  announcement: string | null;
  /** The active course level drag with its candidate slots, or null. */
  courseDrag: CourseDrag | null;
  /** The teachTableId of the candidate raised by hover during a course drag. */
  raised: string | null;
  /** A visible one line hint shown after a missed course drop, or null. */
  hint: string | null;
  start: (course: Course, section: Section, placed: Section[]) => void;
  /** End a valid or cancelled drag, clearing the active state with no feedback. */
  clearActive: () => void;
  /** End a blocked drop: surface the reason and alternatives, clear the drag. */
  reject: () => void;
  /** Surface a blocked outcome that did not come from a drag, such as a blocked
   * add from the button, so keyboard users get the same reason and alternatives. */
  showBlocked: (feedback: BlockedFeedback) => void;
  clearBlocked: () => void;
  setHover: (section: Section) => void;
  clearHover: () => void;
  announce: (message: string) => void;
  clearAnnouncement: () => void;
  startCourse: (course: Course, placed: Section[]) => void;
  clearCourse: () => void;
  setRaised: (teachTableId: string | null) => void;
  setHint: (message: string) => void;
  clearHint: () => void;
}

export function createDragStore() {
  return createStore<DragStore>((set, get) => ({
    active: null,
    blocked: null,
    hover: null,
    announcement: null,
    courseDrag: null,
    raised: null,
    hint: null,
    start: (course, section, placed) => {
      const group = expandSectionGroup(course, section);
      const placement = checkPlacement(placed, group);
      set({
        active: { course, section, group, placement },
        blocked: null,
        hover: null,
      });
    },
    clearActive: () => {
      set({ active: null });
    },
    reject: () => {
      const { active } = get();
      if (active !== null && !active.placement.ok) {
        set({
          active: null,
          blocked: {
            course: active.course,
            section: active.section,
            conflicts: active.placement.conflicts,
          },
        });
      } else {
        set({ active: null });
      }
    },
    showBlocked: (feedback) => {
      set({ active: null, blocked: feedback, announcement: null });
    },
    clearBlocked: () => {
      set({ blocked: null });
    },
    setHover: (section) => {
      set({ hover: section });
    },
    clearHover: () => {
      set({ hover: null });
    },
    announce: (message) => {
      set({ announcement: message });
    },
    clearAnnouncement: () => {
      set({ announcement: null });
    },
    startCourse: (course, placed) => {
      set({
        courseDrag: { course, candidates: courseCandidates(course, placed) },
        active: null,
        blocked: null,
        hover: null,
        raised: null,
        hint: null,
      });
    },
    clearCourse: () => {
      set({ courseDrag: null, raised: null });
    },
    setRaised: (teachTableId) => {
      set({ raised: teachTableId });
    },
    setHint: (message) => {
      set({ hint: message });
    },
    clearHint: () => {
      set({ hint: null });
    },
  }));
}

/** The single drag store instance the drag context, grid, and strip read. */
export const dragStore = createDragStore();
