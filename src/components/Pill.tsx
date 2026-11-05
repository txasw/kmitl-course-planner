// A small status pill used for section state and plan entry badges. The tone maps to the
// design token color pairs; no tone uses the brand orange, which is reserved for
// interactive accents.
//
// The label is always visible. The pill once collapsed to its icon on a narrow
// container and moved the label into a tooltip on a span, which keyboard and touch
// users could not open, so the label now wraps with the pill as one unit instead.

import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'success' | 'danger' | 'warn';

const TONE_CLASS: Record<PillTone, string> = {
  neutral: 'bg-surface-alt text-ink-soft',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-surface-alt text-warn',
};

const BASE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-kcp-inner px-1.5 py-0.5 text-xs font-semibold';

interface PillProps {
  tone: PillTone;
  children: ReactNode;
  /** A decorative icon before the label. The label carries the meaning. */
  icon?: ReactNode;
}

export function Pill({ tone, children, icon }: PillProps) {
  return (
    <span className={`${BASE} ${TONE_CLASS[tone]}`}>
      {icon !== undefined ? (
        <span aria-hidden className="flex shrink-0 items-center">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
