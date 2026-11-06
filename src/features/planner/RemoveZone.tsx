// The remove drop target, shown only while a placed block is dragged. Dropping a block
// here takes its section and its pair out of the plan, with the usual undo. The zone
// takes one of two forms per drag, never both (ADR-0059). While the docked catalog column
// is shown, the column itself is the zone: the block came from the list, so dragging it
// back there reads as remove. Otherwise a bar at the panel bottom is. Neither form
// resizes the grid mid drag, which would shift the candidate slots the same drag just
// painted, and a hidden column is never a target. Every form's id carries one prefix,
// which the collision priority ranks first, so a drop that lands on a zone wins over an
// overlapping candidate slot.

import { useDroppable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';
import { useStore } from 'zustand';
import { uiStore } from '@/features/shell/uiStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { isDockedTier, type LayoutTier } from '@/lib/ui/breakpoints';
import { dragStore, selectBlockMoving } from './dragStore';

/** Every remove target id starts with this prefix, so the collision priority and the
 * drop handler treat each form of the zone alike. */
const REMOVE_ZONE_PREFIX = 'kcp-remove-';

/** The id of the column form, the docked catalog column as a remove zone. */
export const REMOVE_CATALOG_ID = `${REMOVE_ZONE_PREFIX}catalog`;

/** The id of the bar form, along the panel bottom where no column is shown. */
export const REMOVE_BAR_ID = `${REMOVE_ZONE_PREFIX}bar`;

/** Whether a drop target id names a remove zone. */
export function isRemoveZoneId(id: string | number | undefined): boolean {
  return typeof id === 'string' && id.startsWith(REMOVE_ZONE_PREFIX);
}

export type RemoveZoneForm = 'column' | 'bar';

/** The form the remove zone takes: the column while the docked column is shown, the bar
 * at the panel bottom on every other tier and while the docked column is hidden. */
export function removeZoneForm(
  tier: LayoutTier,
  catalogVisible: boolean,
): RemoveZoneForm {
  return isDockedTier(tier) && catalogVisible ? 'column' : 'bar';
}

/**
 * Whether the given form of the remove zone is mounted now: a block drag is live and the
 * layout calls for that form. The column cannot be shown or hidden during a drag, so the
 * form chosen at drag start holds until the drag ends.
 */
export function useRemoveZoneActive(
  tier: LayoutTier,
  form: RemoveZoneForm,
): boolean {
  const catalogVisible = useStore(uiStore, (state) => state.catalogVisible);
  return useStore(
    dragStore,
    (state) =>
      selectBlockMoving(state) && removeZoneForm(tier, catalogVisible) === form,
  );
}

/** The centred label of a zone. The icon keeps its size in both states, so turning
 * solid while a block is over the zone never reflows it. */
function RemovePill({ over }: { over: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-kcp border-2 border-danger px-4 py-2 text-sm font-semibold ${
        over ? 'bg-danger text-surface' : 'bg-surface text-danger'
      }`}
    >
      <Trash2 size={24} aria-hidden />
      {over ? t('dropZone.removeOver') : t('dropZone.remove')}
    </span>
  );
}

/**
 * The column form, laid over the docked catalog column, whose box it measures as. It
 * takes no pointer events and sets no stacking order, so it paints above the column's
 * content, which the column dims while the zone is up. Its fill multiplies onto that
 * content, so the white of the column reads as the zone token exactly and the list
 * still shows faintly through it.
 */
export function CatalogRemoveZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: REMOVE_CATALOG_ID,
    data: { role: 'remove' },
  });
  return (
    <div
      ref={setNodeRef}
      data-remove-zone="column"
      data-over={isOver || undefined}
      className="pointer-events-none absolute inset-0"
    >
      <span
        aria-hidden
        className={`absolute inset-0 mix-blend-multiply ${
          isOver ? 'bg-danger-zone-over' : 'bg-danger-zone'
        }`}
      />
      <div
        className={`absolute inset-2 flex items-center justify-center rounded-kcp border-2 border-danger p-4 ${
          isOver ? 'border-solid' : 'border-dashed'
        }`}
      >
        <RemovePill over={isOver} />
      </div>
    </div>
  );
}

/**
 * The bar form, a 64 px band across the panel bottom over the summary bar. It is the zone
 * on the tiers below the dock and while the docked column is hidden, and it mounts only
 * while a block drag is live. Below 640 px the panel body runs to the screen edge, so the
 * bar pads clear of the device's bottom inset; above it the overlay body already does.
 */
export function RemoveBar({ tier }: { tier: LayoutTier }) {
  const active = useRemoveZoneActive(tier, 'bar');
  return active ? <BarZone /> : null;
}

function BarZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: REMOVE_BAR_ID,
    data: { role: 'remove' },
  });
  return (
    <div
      ref={setNodeRef}
      data-remove-zone="bar"
      data-over={isOver || undefined}
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-dropzone box-content flex h-16 items-center justify-center border-t-2 border-danger max-sm:pb-(--kcp-safe-bottom) ${
        isOver
          ? 'border-solid bg-danger-zone-over'
          : 'border-dashed bg-danger-zone'
      }`}
    >
      <RemovePill over={isOver} />
    </div>
  );
}
