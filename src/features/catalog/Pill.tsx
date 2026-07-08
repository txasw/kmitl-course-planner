// A small status pill used for seat status and section state. The tone maps to
// the design token color pairs; no tone uses the brand orange, which is reserved
// for interactive accents.

import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'success' | 'danger' | 'warn';

const TONE_CLASS: Record<PillTone, string> = {
  neutral: 'bg-surface-alt text-ink-soft',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-surface-alt text-warn',
};

interface PillProps {
  tone: PillTone;
  children: ReactNode;
}

export function Pill({ tone, children }: PillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-kcp px-1.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
