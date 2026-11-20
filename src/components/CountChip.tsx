// The shared count badge of the panel controls: a small ink filled pill with white
// figures and a ring of the surface, so it reads the same beside a label, over an icon,
// or in the edge rail.
// It counts the courses of the last search on the header sheet toggle, the edge rail, and
// the bottom nav, the selected subjects on the bottom nav, and the filters in use on the
// filter button. Ink rather than the brand orange, because the orange marks what can be
// pressed and the badge is a figure, not a control. It is a visual repeat of a number the
// control's accessible name already carries, so it is hidden from assistive technology.

interface CountChipProps {
  count: number;
}

export function CountChip({ count }: CountChipProps) {
  return (
    <span
      aria-hidden
      data-count-badge
      className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-ink px-1 text-2xs leading-none font-semibold text-surface tabular-nums ring-2 ring-surface"
    >
      {count}
    </span>
  );
}
