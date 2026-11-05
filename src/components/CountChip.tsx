// The round chip that shows the course count of the last search result beside a control
// that brings the catalog into view: the header sheet toggle and the docked column's edge
// rail. It is a visual repeat of a number the control's accessible name already carries,
// so the control, not the chip, is what assistive technology reads.

interface CountChipProps {
  count: number;
}

export function CountChip({ count }: CountChipProps) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-surface px-1.5 text-2xs font-semibold tabular-nums text-ink">
      {count}
    </span>
  );
}
