// The remove and undo flow of the updates dialog. A removal goes through the plan store's
// remove, so it runs the transaction primitive, takes the declared pair with it, and joins
// the plan's undo window like any other removal. The dialog keeps every item the removal
// took, the pair partner included, so each stays listed as removed with its undo rather
// than vanishing from the review. Focus moves from the pressed remove to the undo that
// replaces it, and back to the remove after an undo, since each press unmounts its control.

import { useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import type { UpdateItem } from '@/lib/planner/updateReview';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { planStore } from './planStore';

export interface ReviewRemoval {
  /** The items the student removed from the dialog. */
  removed: UpdateItem[];
  /** Whether the plan's pending undo still holds the removal of the entry. */
  canUndo: (teachTableId: string) => boolean;
  remove: (item: UpdateItem) => void;
  undo: (item: UpdateItem) => void;
}

/** The controls in the dialog body that carry the attribute with the entry id. */
function controls(
  body: RefObject<HTMLElement | null>,
  attribute: string,
  id: string,
): HTMLElement[] {
  return Array.from(
    body.current?.querySelectorAll<HTMLElement>(`[${attribute}]`) ?? [],
  ).filter((element) => element.getAttribute(attribute) === id);
}

export function useReviewRemoval(
  body: RefObject<HTMLElement | null>,
  liveItems: readonly UpdateItem[],
  fallbackFocus: RefObject<HTMLElement | null>,
): ReviewRemoval {
  const [removed, setRemoved] = useState<UpdateItem[]>([]);
  const pendingUndo = useStore(planStore, (state) => state.pendingUndo);

  const canUndo = (teachTableId: string): boolean =>
    pendingUndo?.kind === 'remove' &&
    pendingUndo.removed.some((entry) => entry.teachTableId === teachTableId);

  const remove = (item: UpdateItem): void => {
    const id = item.entry.teachTableId;
    commitThenFocus(
      () => {
        planStore.getState().remove(id);
        const left = new Set(
          planStore.getState().entries.map((entry) => entry.teachTableId),
        );
        const gone = liveItems.filter(
          (live) => !left.has(live.entry.teachTableId),
        );
        const goneIds = new Set(gone.map((live) => live.entry.teachTableId));
        setRemoved((current) => [
          ...current.filter((other) => !goneIds.has(other.entry.teachTableId)),
          ...gone,
        ]);
      },
      () => controls(body, 'data-update-undo', id),
    );
  };

  const undo = (item: UpdateItem): void => {
    const id = item.entry.teachTableId;
    commitThenFocus(
      () => {
        planStore.getState().undo();
      },
      () => [
        ...controls(body, 'data-update-remove', id),
        fallbackFocus.current,
      ],
    );
  };

  return { removed, canUndo, remove, undo };
}
