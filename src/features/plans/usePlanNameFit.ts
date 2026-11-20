// How the header plan switcher shows the plan name whole. The name takes the room the
// header leaves it, so on a wide window a long name rests on one line at the body size.
// Where one line cannot hold it, the name wraps onto two lines at the next step down the
// type scale, and then at the step below that, both sized with the term line under them so
// the trigger never grows past the header row. Only a name longer than two lines of the
// smallest step can hold is shortened with an ellipsis, and the trigger it sits in opens
// the plan list, which wraps every name whole.
//
// The step is found by measuring: on each change of the name or of the room, each step's
// classes are applied to the name in turn and the first that holds it is kept, before the
// browser paints, so the name never shows at a step that cuts it.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { useElementSize } from '@/features/shell/useElementSize';

/** The name steps, from one line at the body size to two clamped lines at the smallest. */
export const PLAN_NAME_STEPS = [
  'max-w-full truncate text-sm',
  'max-w-full text-xs leading-[15px] break-words',
  'max-w-full text-2xs leading-[14px] break-words line-clamp-2',
] as const;

/** The term line under a wrapped name, set tight so name and term fit the header row. */
export const WRAPPED_TERM = 'text-2xs leading-[14px]';

const LAST_STEP = PLAN_NAME_STEPS.length - 1;

/** The classes of the name at a step. */
export function planNameClass(step: number): string {
  return PLAN_NAME_STEPS[step] ?? PLAN_NAME_STEPS[0];
}
// Subpixel layout can report a box a fraction past a whole pixel.
const SLACK = 1;

/** Whether the name element holds its text whole at the classes it carries now. */
function holds(node: HTMLElement, step: number): boolean {
  if (step === 0) return node.scrollWidth <= node.clientWidth + SLACK;
  const lineHeight = parseFloat(getComputedStyle(node).lineHeight);
  return node.scrollHeight <= 2 * lineHeight + SLACK;
}

/**
 * The step the plan name shows at: the first of the steps that holds it whole, or the last
 * step, which clamps it at two lines.
 */
export function usePlanNameFit(
  nameRef: RefObject<HTMLElement | null>,
  roomRef: RefObject<HTMLElement | null>,
  name: string,
): number {
  const [step, setStep] = useState(0);
  const room = useElementSize(roomRef).width;

  useLayoutEffect(() => {
    const node = nameRef.current;
    if (node === null) return;
    const rendered = node.className;
    let found = LAST_STEP;
    for (const [candidate, classes] of PLAN_NAME_STEPS.entries()) {
      if (candidate === LAST_STEP) break;
      node.className = classes;
      if (holds(node, candidate)) {
        found = candidate;
        break;
      }
    }
    node.className = rendered;
    setStep(found);
  }, [nameRef, name, room]);

  return step;
}
