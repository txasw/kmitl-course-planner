// The one status badge a catalog section row shows, chosen by the rowStatus precedence.
// The label is always visible text; the icon only reinforces it. A row with no status,
// an addable section, renders no badge.

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  Check,
  Copy,
  Lock,
} from 'lucide-react';
import { Pill, type PillTone } from '@/components/Pill';
import type { RowStatus } from '@/lib/catalog/rowStatus';
import type { Translate, TranslationKey } from '@/lib/i18n/t';

interface BadgeStyle {
  tone: PillTone;
  icon: ReactNode;
  labelKey: TranslationKey;
}

const BADGE: Record<RowStatus, BadgeStyle> = {
  different_term: {
    tone: 'neutral',
    icon: <CalendarClock size={12} aria-hidden />,
    labelKey: 'section.badge.differentTerm',
  },
  closed: {
    tone: 'neutral',
    icon: <Lock size={12} aria-hidden />,
    labelKey: 'section.badge.closed',
  },
  full: {
    tone: 'danger',
    icon: <Ban size={12} aria-hidden />,
    labelKey: 'section.badge.full',
  },
  added: {
    tone: 'success',
    icon: <Check size={12} aria-hidden />,
    labelKey: 'section.badge.added',
  },
  duplicate: {
    tone: 'warn',
    icon: <Copy size={12} aria-hidden />,
    labelKey: 'section.badge.duplicate',
  },
  time_conflict: {
    tone: 'danger',
    icon: <AlertTriangle size={12} aria-hidden />,
    labelKey: 'section.badge.conflict',
  },
  exam_clash: {
    tone: 'danger',
    icon: <AlertTriangle size={12} aria-hidden />,
    labelKey: 'section.badge.examConflict',
  },
};

interface StatusBadgeProps {
  status: RowStatus | null;
  t: Translate;
}

export function StatusBadge({ status, t }: StatusBadgeProps) {
  if (status === null) {
    return null;
  }
  const { tone, icon, labelKey } = BADGE[status];
  return (
    <Pill tone={tone} icon={icon}>
      {t(labelKey)}
    </Pill>
  );
}
