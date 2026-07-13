// The seat status pill. Open shows the remaining count when the section is
// capped, or no count when it is uncapped. Full and closed carry no count.

import { Ban, Lock, Users } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import type { SeatStatus } from '@/lib/catalog/seatStatus';
import { Pill } from '@/components/Pill';

interface SeatPillProps {
  status: SeatStatus;
  t: Translate;
}

const ICON_SIZE = 12;

export function SeatPill({ status, t }: SeatPillProps) {
  if (status.kind === 'closed') {
    return (
      <Pill
        tone="neutral"
        icon={<Lock size={ICON_SIZE} aria-hidden />}
        label={t('seat.closed')}
      >
        {t('seat.closed')}
      </Pill>
    );
  }
  if (status.kind === 'full') {
    return (
      <Pill
        tone="danger"
        icon={<Ban size={ICON_SIZE} aria-hidden />}
        label={t('seat.full')}
      >
        {t('seat.full')}
      </Pill>
    );
  }
  const label =
    status.remaining === null
      ? t('seat.open')
      : `${t('seat.open')} ${String(status.remaining)}`;
  return (
    <Pill
      tone="success"
      icon={<Users size={ICON_SIZE} aria-hidden />}
      label={label}
    >
      {label}
    </Pill>
  );
}
