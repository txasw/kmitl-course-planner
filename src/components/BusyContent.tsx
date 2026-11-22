// The icon and label of a control whose action runs for a moment before its outcome toast,
// such as an image export or a copy (ADR-0027 amendment of 2026-11-22). While it runs, the
// icon turns into a spinner, still under reduced motion, and the label names the work in
// progress. Both labels sit in one grid cell, the idle one hidden from view and from the
// accessible name, so the control is always as wide and as tall as the longer of the two and
// the row around it never shifts when the label changes. The labels align as the control's
// text does, so a label hugs its icon in a row and centers in a stacked cell.

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
      <span className={`grid ${className}`}>
        {[label, busyLabel].map((text, index) => {
          const hidden = busy === (index === 0);
          return (
            <span
              key={index}
              aria-hidden={hidden || undefined}
              className={`col-start-1 row-start-1${hidden ? ' invisible' : ''}`}
            >
              {text}
            </span>
          );
        })}
      </span>
    </>
  );
}
