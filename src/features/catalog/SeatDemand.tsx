// The seat summary in two variants. The inline variant is the row line: a people icon and
// the seat text, always visible. It replaces the seat pill, whose label collapsed to a
// bare icon on a narrow row with the count left in a tooltip on a span that keyboard and
// touch users could not open. The line never collapses, and a full or closed line states
// that the section cannot be added, so the reason for a disabled add rail reads in the
// row body. The full variant, for the section details, adds the host's four counts as
// labelled figures and, when pre registrations exceed the capacity, a warn line stating
// that fact. It gives no estimate of a student's chance. A catalog row flags the same
// fact with the demand chip beside its seat line. The icons are decorative; the text
// carries the meaning.

import { Fragment } from 'react';
import { AlertCircle, Users } from 'lucide-react';
import type { Translate } from '@/lib/i18n/t';
import {
  DEMAND_LABEL_KEY,
  demandChipText,
  demandFigures,
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

export type SeatDemandVariant = 'inline' | 'full';

interface SeatDemandProps {
  demand: SeatDemandModel;
  t: Translate;
  variant?: SeatDemandVariant;
}

export function SeatDemand({ demand, t, variant = 'inline' }: SeatDemandProps) {
  const line = (
    <p
      className={`flex items-center gap-1 tabular-nums ${TONE_CLASS[demand.state]}`}
    >
      <Users size={12} aria-hidden className="shrink-0" />
      <span>{seatLineText(demand, t)}</span>
    </p>
  );
  if (variant === 'inline') {
    return line;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {line}
      <p className="flex flex-wrap gap-x-2 tabular-nums text-ink">
        {demandFigures(demand).map((figure, index) => {
          // The pre registered count is the figure that exceeds the capacity, so it alone
          // takes the warn tone, label and value together.
          const warn = figure.key === 'pre' && demand.oversubscribed;
          // The space between figures is for the accessible text: the flex gap spaces
          // them on screen, and without it a screen reader runs one value into the
          // next label.
          return (
            <Fragment key={figure.key}>
              {index > 0 ? ' ' : null}
              <span className={warn ? 'text-warn' : undefined}>
                <span className={warn ? undefined : 'text-ink-soft'}>
                  {t(DEMAND_LABEL_KEY[figure.key])}
                </span>{' '}
                {figure.value}
              </span>
            </Fragment>
          );
        })}
      </p>
      {demand.oversubscribed ? (
        <p className="flex items-center gap-1 text-warn">
          <AlertCircle size={12} aria-hidden className="shrink-0" />
          <span>{t('seat.demand.oversubscribed')}</span>
        </p>
      ) : null}
    </div>
  );
}

interface DemandChipProps {
  demand: SeatDemandModel;
  t: Translate;
}

/**
 * The row flag for an oversubscribed section: a warn soft chip with the pre registered
 * and queue counts beside the seat line. It adds no line of its own, so a row grows only
 * when a narrow card wraps the chip, and a row whose demand fits the capacity renders
 * nothing. The sentence that names the fact is read to a screen reader ahead of the
 * counts; the section details state it on screen.
 */
export function DemandChip({ demand, t }: DemandChipProps) {
  if (!demand.oversubscribed) {
    return null;
  }
  return (
    <p className="whitespace-nowrap rounded-kcp-inner bg-warn-soft px-1.5 tabular-nums text-warn">
      <span className="sr-only">{t('seat.demand.oversubscribed')} </span>
      {demandChipText(demand, t)}
    </p>
  );
}
