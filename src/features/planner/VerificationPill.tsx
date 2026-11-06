// The verification and conflict pill a placed section shows outside the grid, on the
// unscheduled shelf and in the selected courses list. It folds the states the way a
// block badge does, danger over warn, and lists every label that applies, so a section
// that both changed and clashes on an exam reads both. A clean section renders nothing.

import { AlertTriangle } from 'lucide-react';
import type { VerifyStatus } from '@/lib/domain/plan';
import type { Translate } from '@/lib/i18n/t';
import { Pill } from '@/components/Pill';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';

interface VerificationPillProps {
  verifyStatus: VerifyStatus;
  /** Whether a time change put the section into conflict with another entry. */
  conflicted: boolean;
  /** Whether the section's exam window overlaps another entry's. */
  examConflicted: boolean;
  t: Translate;
}

export function VerificationPill({
  verifyStatus,
  conflicted,
  examConflicted,
  t,
}: VerificationPillProps) {
  const badge = blockBadge(verifyStatus, conflicted, examConflicted);
  const text = blockBadgeLabelKeys(verifyStatus, conflicted, examConflicted)
    .map((key) => t(key))
    .join(' ');
  if (badge === null || text === '') {
    return null;
  }
  return (
    <Pill tone={badge} icon={<AlertTriangle size={12} aria-hidden />}>
      {text}
    </Pill>
  );
}
