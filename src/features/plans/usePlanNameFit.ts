// How the header plan switcher shows the plan name whole. The name takes the room the
// header leaves it, so on a wide window a long name rests on one line at the body size.
// Where one line cannot hold it, the name wraps onto two lines at the next step down the
// type scale, sized with the term line under them so the trigger stays inside the header
// row. A name that two lines of that step cannot hold wraps at the smallest step onto as
// many lines as it needs, and the trigger and the header grow to hold them, so no name is
// ever cut with an ellipsis at any width.
//
// The step is found by measuring: on each change of the name or of the room, each step's
// classes are applied to the name in turn and the first that holds it is kept, before the
// browser paints, so the name never shows at a step that cuts it.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { useElementSize } from '@/features/shell/useElementSize';

/** The name steps, from one line at the body size to every line it needs at the smallest. */
export const PLAN_NAME_STEPS = [
  'max-w-full truncate text-sm',
  'max-w-full text-xs leading-[15px] break-words',
  'max-w-full text-2xs leading-[14px] break-words',
] as const;

/** The term line under a wrapped name, set tight so name and term fit the header row. */
export const WRAPPED_TERM = 'text-2xs leading-[14px]';

const LAST_STEP = PLAN_NAME_STEPS.length - 1;

/**
 * The block padding of the trigger at each step: a hair around one line, none around two
 * lines so they keep to the header row, and a little around the smallest step, where the
 * trigger grows with the name and its lines would otherwise meet the trigger edge.
 */
const TRIGGER_PADDING = ['py-px', 'py-0', 'py-1'] as const;

/** The block padding of the plan switcher trigger at a step. */
export function triggerPadding(step: number): string {
  return TRIGGER_PADDING[step] ?? TRIGGER_PADDING[0];
}

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
 * step, which wraps it onto every line it needs.
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
