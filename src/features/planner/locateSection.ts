// Shows a placed section on the timetable, for the updates dialog's show on timetable action
// and the stats bar conflict action. The dialog closes first, so the section's earliest
// block, of those the timetable renders, is scrolled into view, takes
// focus, and pulses twice in the brand orange, the accent for selection, so the eye lands
// on it. A section with no meeting has no block; its shelf row scrolls into view and pulses
// instead, and focus stays where the closing dialog returned it, since the row's only
// control is its remove button. Reduced motion holds the ring still for the same time in
// place of the pulse, and the scroll jumps rather than glides.

const LOCATE_CLASS = 'kcp-locate';

/** Two pulses of the slow duration token, the time the ring stays in either mode. */
export const LOCATE_MS = 600;

function earliestBlock(
  root: ParentNode,
  teachTableId: string,
): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-block-order]'))
    .filter((element) => element.dataset.teachTableId === teachTableId)
    .sort(
      (a, b) => Number(a.dataset.blockOrder) - Number(b.dataset.blockOrder),
    )[0];
}

function shelfRow(
  root: ParentNode,
  teachTableId: string,
): HTMLElement | undefined {
  const remove = Array.from(
    root.querySelectorAll<HTMLElement>('[data-shelf-remove]'),
  ).find((element) => element.dataset.shelfRemove === teachTableId);
  return remove?.closest<HTMLElement>('li') ?? undefined;
}

/**
 * Bring the section into view and pulse it. Returns the element it marked, or null when
 * the section shows nowhere, as when it was removed or the timetable is not rendered.
 */
export function locateSection(
  root: ParentNode,
  teachTableId: string,
  reducedMotion: boolean,
): HTMLElement | null {
  const block = earliestBlock(root, teachTableId);
  const target = block ?? shelfRow(root, teachTableId);
  if (target === undefined) {
    return null;
  }
  target.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: reducedMotion ? 'auto' : 'smooth',
  });
  block?.focus({ preventScroll: true });
  target.classList.add(LOCATE_CLASS);
  window.setTimeout(() => {
    target.classList.remove(LOCATE_CLASS);
  }, LOCATE_MS);
  return target;
}
