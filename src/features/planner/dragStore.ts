// The drag session state. Validation runs once when a drag starts, because every
// section has a fixed footprint, and the result holds for the whole drag: the grid
// ghosts and the reason chip read it without recomputing per frame. A rejected
// drop moves the active drag into a blocked feedback the strip renders with its
// reason and alternatives. It is a singleton store so the grid, the chip, and the
// strip read it without threading props through the drag context.

import { createStore } from 'zustand/vanilla';
import type { Course, Section } from '@/lib/domain/types';
import {
  checkPlacement,
  expandSectionGroup,
  type ConflictDetail,
  type PlacementResult,
} from '@/lib/planner/placement';

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

export interface DragStore {
  active: ActiveDrag | null;
  blocked: BlockedFeedback | null;
  start: (course: Course, section: Section, placed: Section[]) => void;
  /** End a valid or cancelled drag, clearing the active state with no feedback. */
  clearActive: () => void;
  /** End a blocked drop: surface the reason and alternatives, clear the drag. */
  reject: () => void;
  clearBlocked: () => void;
}

export function createDragStore() {
  return createStore<DragStore>((set, get) => ({
    active: null,
    blocked: null,
    start: (course, section, placed) => {
      const group = expandSectionGroup(course, section);
      const placement = checkPlacement(placed, group);
      set({ active: { course, section, group, placement }, blocked: null });
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
    clearBlocked: () => {
      set({ blocked: null });
    },
  }));
}

/** The single drag store instance the drag context, grid, and strip read. */
export const dragStore = createDragStore();
