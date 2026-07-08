// The seat status pill. Open shows the remaining count when the section is
// capped, or no count when it is uncapped. Full and closed carry no count.

import type { Translate } from '@/lib/i18n/t';
import type { SeatStatus } from '@/lib/catalog/seatStatus';
import { Pill } from '@/components/Pill';

interface SeatPillProps {
  status: SeatStatus;
  t: Translate;
}

export function SeatPill({ status, t }: SeatPillProps) {
  if (status.kind === 'closed') {
    return <Pill tone="neutral">{t('seat.closed')}</Pill>;
  }
  if (status.kind === 'full') {
    return <Pill tone="danger">{t('seat.full')}</Pill>;
  }
  const label =
    status.remaining === null
      ? t('seat.open')
      : `${t('seat.open')} ${String(status.remaining)}`;
  return <Pill tone="success">{label}</Pill>;
}
