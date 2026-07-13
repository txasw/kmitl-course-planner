// A small status pill used for seat status and section state. The tone maps to the design
// token color pairs; no tone uses the brand orange, which is reserved for interactive
// accents.
//
// When given an icon, the pill can collapse to icon-only on a narrow container, with its
// label moved into a tooltip and kept in the accessibility tree (visually hidden, not
// removed), so the accessible name is always the full label. The collapse is driven by a
// container query, so it needs an ancestor marked as a container (the @container class on
// the chip cluster).

import type { ReactNode } from 'react';
import { Tooltip } from './Tooltip';

export type PillTone = 'neutral' | 'success' | 'danger' | 'warn';

const TONE_CLASS: Record<PillTone, string> = {
  neutral: 'bg-surface-alt text-ink-soft',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-surface-alt text-warn',
};

const BASE =
  'inline-flex items-center rounded-kcp px-1.5 py-0.5 text-xs font-medium';

interface PillProps {
  tone: PillTone;
  children: ReactNode;
  /** An icon shown at all widths. When set, the label collapses to icon-only on a narrow
   * container and the tooltip carries the label. */
  icon?: ReactNode;
  /** The full label for the tooltip, used only with an icon; defaults to the children. */
  label?: string;
}

export function Pill({ tone, children, icon, label }: PillProps) {
  if (icon === undefined) {
    return <span className={`${BASE} ${TONE_CLASS[tone]}`}>{children}</span>;
  }
  return (
    <Tooltip label={label ?? children}>
      {(triggerProps, ref) => (
        <span
          ref={ref}
          {...triggerProps}
          className={`${BASE} gap-1 ${TONE_CLASS[tone]}`}
        >
          <span aria-hidden className="flex shrink-0 items-center">
            {icon}
          </span>
          {/* Hidden from view on a narrow container, kept for the accessible name. */}
          <span className="@max-[15rem]:sr-only">{children}</span>
        </span>
      )}
    </Tooltip>
  );
}
