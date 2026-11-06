// Wires a course card to the grid preview of its sections. A deliberate mouse rest on the
// card header, read by useHoverIntent, or a keyboard focus of its toggle shows where the
// sections would land; leaving, blurring, a press, a scroll or Escape clears it. It is
// offered only on the docked tiers, where the grid sits beside the catalog; on the sheet
// tiers the sheet covers the grid, so the card's own summary is the answer there. An
// added or cross term card offers no preview. The preview is cleaned up when the card
// unmounts or stops offering it, and follows the card when the filtered course changes.

import { useEffect, type FocusEvent } from 'react';
import { useStore } from 'zustand';
import type { Course } from '@/lib/domain/types';
import { BREAKPOINTS, minWidthQuery } from '@/lib/ui/breakpoints';
import { dragStore } from '@/features/planner/dragStore';
import { useHoverIntent, type HoverIntentHandlers } from './useHoverIntent';

// Read at the moment of the intent rather than subscribed, so a catalog of a hundred
// cards holds no media query listener per card.
function dockedViewport(): boolean {
  return window.matchMedia(minWidthQuery(BREAKPOINTS.lg)).matches;
}

export interface CoursePreviewHandlers {
  /** Spread on the card header. */
  hover: HoverIntentHandlers;
  /** Spread on the card toggle for keyboard parity. */
  focus: {
    onFocus: (event: FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
  };
}

export function useCoursePreview(
  course: Course,
  offered: boolean,
): CoursePreviewHandlers {
  const { subjectId } = course;
  const showing = useStore(
    dragStore,
    (state) => state.hoverCourse?.subjectId === subjectId,
  );
  const show = () => {
    if (offered && dockedViewport()) {
      dragStore.getState().setHoverCourse(course);
    }
  };
  const clear = () => {
    dragStore.getState().clearHoverCourse(subjectId);
  };

  const hover = useHoverIntent({
    enabled: offered,
    showing,
    onIntent: show,
    onClear: clear,
  });

  // A card that stops offering the preview, once added or browsed from another term,
  // clears it; a refiltered course replaces it so the footprints match the open card.
  useEffect(() => {
    const { hoverCourse, setHoverCourse, clearHoverCourse } =
      dragStore.getState();
    if (hoverCourse?.subjectId !== course.subjectId) return;
    if (!offered) clearHoverCourse(course.subjectId);
    else if (hoverCourse !== course) setHoverCourse(course);
  }, [course, offered]);

  useEffect(
    () => () => {
      dragStore.getState().clearHoverCourse(subjectId);
    },
    [subjectId],
  );

  return {
    hover,
    focus: {
      // Only a focus the browser marks focus-visible previews, so a click on the toggle,
      // or a focus moved by code after a pointer action, never paints the grid.
      onFocus: (event) => {
        if (event.currentTarget.matches(':focus-visible')) show();
      },
      onBlur: clear,
    },
  };
}
