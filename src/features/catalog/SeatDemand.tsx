// The inline seat line: a people icon and the seat text, always visible. It replaces the
// seat pill, whose label collapsed to a bare icon on a narrow row with the count left in
// a tooltip on a span that keyboard and touch users could not open. The line never
// collapses, and a full or closed line states that the section cannot be added, so the
// reason for a disabled add rail reads in the row body. The icon is decorative; the text
// carries the meaning.

import { Users } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import {
  seatLineText,
  type SeatDemand as SeatDemandModel,
  type SeatState,
} from '@/lib/catalog/seatDemand';

const TONE_CLASS: Record<SeatState, string> = {
  open: 'text-success',
  uncapped: 'text-success',
  full: 'text-danger',
  closed: 'text-ink-soft',
};

interface SeatDemandProps {
  demand: SeatDemandModel;
  t: Translate;
}

export function SeatDemand({ demand, t }: SeatDemandProps) {
  return (
    <p
      className={`flex items-center gap-1 tabular-nums ${TONE_CLASS[demand.state]}`}
    >
      <Users size={12} aria-hidden className="shrink-0" />
      <span>{seatLineText(demand, t)}</span>
    </p>
  );
}
