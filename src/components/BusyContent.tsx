// The icon and label of a control whose action runs for a moment before its outcome toast,
// such as an image export or a copy (ADR-0027 amendment of 2026-11-22). While it runs, the
// icon turns into a spinner, still under reduced motion, and the label names the work in
// progress. The busy label lies over the idle label, and the inactive one is hidden from view
// and from the accessible name. Only the idle label takes room: the busy label sits out of
// flow across the idle label's width on one line, so the control at rest is as wide and as
// tall as with no busy label at all, and the row around it never shifts when the label
// changes. A busy label is kept short enough to fit; one that does not ends in an ellipsis
// rather than widening the control. The labels align as the control's text does, so a label
// hugs its icon in a row and centers in a stacked cell.

import { LoaderCircle, type LucideIcon } from 'lucide-react';

interface BusyContentProps {
  icon: LucideIcon;
  size: number;
  label: string;
  busyLabel: string;
  busy: boolean;
  /** Classes for the label cell, such as its text alignment. */
  className?: string;
}

export function BusyContent({
  icon,
  size,
  label,
  busyLabel,
  busy,
  className = '',
}: BusyContentProps) {
  const Icon = busy ? LoaderCircle : icon;
  return (
    <>
      <Icon
        size={size}
        strokeWidth={2}
        aria-hidden
        className={busy ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      <span className={`relative ${className}`}>
        <span aria-hidden={busy} className={busy ? 'invisible' : undefined}>
          {label}
        </span>
        <span
          aria-hidden={!busy}
          className={`absolute inset-x-0 top-0 truncate${busy ? '' : ' invisible'}`}
        >
          {busyLabel}
        </span>
      </span>
    </>
  );
}
