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
import { areDeclaredPair } from '@/lib/planner/conflicts';
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

/** The durable identity a candidate exclude set keys on. */
function identity(section: Section): string {
  return `${section.subjectId}:${section.section}`;
}

/** The distinct teachTableIds of the placed sections a set of conflicts blocks. */
export function blockerIds(conflicts: ConflictDetail[]): string[] {
  return [
    ...new Set(conflicts.map((conflict) => conflict.blocking.teachTableId)),
  ];
}

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

export interface BlockMoveDrag {
  /** The placed section being dragged off its slot. */
  section: Section;
  /** The dragged section and its pair, the group that leaves on a move or remove. */
  group: Section[];
  /** The resolved course, or null when the subject is not in the current catalog. */
  course: Course | null;
  /** The subject's other sections as move targets; empty when the course is null. */
  candidates: Candidate[];
}

export interface CourseDrag {
  course: Course;
  candidates: Candidate[];
}

export interface SwapContext {
  /** The section that would be added by the exchange. */
  incoming: Section;
  /** The incoming section's course, for pair expansion on commit. */
  course: Course;
  /** A placed block to remove alongside the blocker, for a block move onto a swap
   * target; null for a section or course drag swap. */
  originId: string | null;
  /** The teachTableIds of the placed blocks that block the incoming section, each a
   * swap target. */
  blockers: string[];
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
  /** The active placed block drag, moving a section off its slot, or null. */
  blockMove: BlockMoveDrag | null;
  /** The teachTableId of the candidate raised by hover during a course or block
   * drag. */
  raised: string | null;
  /** A visible one line hint shown after a missed course drop, or null. */
  hint: string | null;
  /** What a drop on a swap target would exchange, or null when nothing is blocked.
   * Latched so it survives the pointer moving from a blocked candidate to a target. */
  swapContext: SwapContext | null;
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
  /** Start dragging a placed section: paint its subject's other sections as move
   * targets against the plan minus this section and its pair. */
  startBlockMove: (
    section: Section,
    placed: Section[],
    course: Course | null,
  ) => void;
  clearBlockMove: () => void;
  setRaised: (teachTableId: string | null) => void;
  /** Latch or clear the swap context as a blocked candidate is hovered. */
  setSwapContext: (context: SwapContext | null) => void;
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
    blockMove: null,
    raised: null,
    hint: null,
    swapContext: null,
    start: (course, section, placed) => {
      const group = expandSectionGroup(course, section);
      const placement = checkPlacement(placed, group);
      set({
        active: { course, section, group, placement },
        // A blocked section drag can swap: every blocking block is a swap target.
        swapContext: placement.ok
          ? null
          : {
              incoming: section,
              course,
              originId: null,
              blockers: blockerIds(placement.conflicts),
            },
        courseDrag: null,
        blockMove: null,
        blocked: null,
        hover: null,
        raised: null,
        hint: null,
      });
    },
    clearActive: () => {
      set({ active: null, swapContext: null });
    },
    reject: () => {
      const { active } = get();
      if (active !== null && !active.placement.ok) {
        set({
          active: null,
          swapContext: null,
          blocked: {
            course: active.course,
            section: active.section,
            conflicts: active.placement.conflicts,
          },
        });
      } else {
        set({ active: null, swapContext: null });
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
        blockMove: null,
        blocked: null,
        hover: null,
        raised: null,
        hint: null,
        swapContext: null,
      });
    },
    clearCourse: () => {
      set({ courseDrag: null, raised: null, swapContext: null });
    },
    startBlockMove: (section, placed, course) => {
      const pair = placed.filter(
        (other) =>
          other.teachTableId !== section.teachTableId &&
          areDeclaredPair(section, other),
      );
      const group = [section, ...pair];
      const exclude = new Set(group.map(identity));
      set({
        blockMove: {
          section,
          group,
          course,
          candidates:
            course === null ? [] : courseCandidates(course, placed, exclude),
        },
        active: null,
        courseDrag: null,
        blocked: null,
        hover: null,
        raised: null,
        hint: null,
        swapContext: null,
      });
    },
    clearBlockMove: () => {
      set({ blockMove: null, raised: null, swapContext: null });
    },
    setRaised: (teachTableId) => {
      set({ raised: teachTableId });
    },
    setSwapContext: (context) => {
      set({ swapContext: context });
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
