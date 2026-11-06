// The place role of the drop zone vocabulary (ADR-0059): while a valid section drag is
// live, a single outline inset over the planner drop zone shows the region where a release
// commits, from the moment the drag activates rather than from hover. It is dashed while
// the pointer is elsewhere and turns solid with a soft ring while the pointer is over the
// zone. It carries no text, so a drag that fits still says nothing visible. It shares the
// scrim layer, above the grid's sticky axes and below a sheet that yields over the grid.

import { useStore } from 'zustand';
import { dragStore, type DragStore } from './dragStore';

/** Whether the live drag is a section drag whose placement fits. */
function selectValidSectionDrag(state: DragStore): boolean {
  return state.active?.placement.ok === true;
}

export function CommitZoneOutline({ over }: { over: boolean }) {
  const valid = useStore(dragStore, selectValidSectionDrag);
  if (!valid) {
    return null;
  }
  return (
    <div
      aria-hidden
      data-commit-zone={over ? 'over' : 'latent'}
      className={`pointer-events-none absolute inset-1 z-scrim rounded-kcp border-2 border-success transition-shadow duration-fast motion-reduce:transition-none ${
        over ? 'border-solid ring-2 ring-success/40' : 'border-dashed'
      }`}
    />
  );
}
