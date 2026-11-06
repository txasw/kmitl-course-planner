// The catalog column's part in a drag. A drag measures every drop zone when it starts and
// as zones mount, so a column caught mid slide would leave the catalog remove zone
// measured where the column was passing, not where it settles; the slide is finished at
// drag start instead. During a block drag the shown column is the remove zone, so nothing
// inside it may auto scroll under the pointer and move the list the student is dropping
// onto (ADR-0059).

import {
  CATALOG_COLUMN_ID,
  finishCatalogSlide,
} from '@/features/shell/catalogVisibility';
import { dragStore, selectBlockMoving } from './dragStore';

/** Jump a running catalog slide to its end, found through the event that began the drag,
 * so the column sits at its final position before any drop zone is measured. */
export function settleCatalogSlide(activator: Event | null): void {
  const target = activator?.target;
  if (!(target instanceof Node)) return;
  const root = target.getRootNode();
  if (root instanceof Document || root instanceof ShadowRoot) {
    finishCatalogSlide(root);
  }
}

/** dnd-kit's auto scroll guard: any scroller may follow the pointer except one inside the
 * catalog column while a placed block is dragged. */
export function mayAutoScroll(element: Element): boolean {
  return !(
    selectBlockMoving(dragStore.getState()) &&
    element.closest(`#${CATALOG_COLUMN_ID}`) !== null
  );
}
