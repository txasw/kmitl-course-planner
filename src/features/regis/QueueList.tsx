// The list view of the helper card, opened from the count: every planned subject as a
// compact row with its status cell, its section, and its full id and name, so the whole
// registration reads at a glance. Pressing a row puts that subject in focus on the card. A
// subject still to add carries Add for me on its row, the same action the card offers.

import { pickLocalized } from '@/lib/i18n/localize';
import type { Locale, Translate } from '@/lib/i18n/t';
import { shownSections, type ChecklistRow } from '@/lib/regis/checklist';
import {
  STATUS_TONE,
  needsAction,
  type HelperStatus,
} from '@/lib/regis/helperStatus';
import { FOCUS_RING } from '@/lib/ui/focus';
import { AddForMeButton } from './fill/FillControls';
import { BlockedAddButton } from './ActionRow';
import { PartsLine, partsText, sectionParts } from './SectionTile';
import { StatusIcon } from './StatusIcon';
import {
  STALE_FILL,
  TONE_FILL,
  TONE_ICON,
  bandKey,
  shortKey,
} from './statusMeta';
import { useAddBlock } from './useAddBlock';
import type { HelperModel } from './useHelperModel';

export const LIST_ID = 'kcp-regis-list';

interface QueueListProps {
  model: HelperModel;
  currentId: string | null;
  locale: Locale;
  t: Translate;
  onPick: (subjectId: string) => void;
}

function RowAction({
  model,
  row,
  status,
  t,
}: {
  model: HelperModel;
  row: ChecklistRow;
  status: HelperStatus;
  t: Translate;
}) {
  const { block, reason } = useAddBlock(model, row, t);
  const { plan, kit } = model;
  if (status !== 'todo' && status !== 'full') return null;
  if (block === null && plan !== null && kit !== null) {
    return (
      <span className="flex items-center pr-2">
        <AddForMeButton
          row={row}
          plan={plan}
          kit={kit}
          allowFull={status === 'full'}
          compact
          t={t}
        />
      </span>
    );
  }
  return (
    <span className="flex items-center pr-2">
      <BlockedAddButton
        reason={reason}
        coarse={false}
        subjectId={row.subjectId}
        t={t}
      />
    </span>
  );
}

export function QueueList({
  model,
  currentId,
  locale,
  t,
  onPick,
}: QueueListProps) {
  const rows = model.checklist?.rows ?? [];
  return (
    <ul
      id={LIST_ID}
      aria-label={t('regis.queue')}
      className="kcp-scroll min-h-0 max-h-140 overflow-y-auto rounded-b-kcp border-t border-border max-sm:max-h-74"
    >
      {rows.map((row) => {
        const status = model.statuses[row.subjectId] ?? 'todo';
        const tone = STATUS_TONE[status];
        const parts = sectionParts(shownSections(row, status === 'other'), t);
        const name = pickLocalized(row.nameTh, row.nameEn, locale);
        const current = row.subjectId === currentId;
        const band = t(bandKey(status));
        return (
          <li
            key={row.subjectId}
            className={`flex border-b border-border last:border-b-0 ${
              current ? 'outline-2 -outline-offset-2 outline-primary' : ''
            }`}
          >
            <button
              type="button"
              data-status={status}
              aria-current={current || undefined}
              aria-label={`${row.subjectId} ${name}, ${partsText(parts)}, ${band}`}
              onClick={() => {
                onPick(row.subjectId);
              }}
              className={`grid min-h-[60px] min-w-0 flex-1 grid-cols-[72px_1fr] text-left ${FOCUS_RING}`}
            >
              <span
                className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-xs leading-4 font-semibold ${
                  model.stale ? STALE_FILL : TONE_FILL[tone]
                }`}
              >
                <StatusIcon
                  status={status}
                  size={16}
                  className={
                    model.stale
                      ? 'text-ink-muted'
                      : tone === 'neutral' || tone === 'busy'
                        ? TONE_ICON[tone]
                        : ''
                  }
                />
                {t(shortKey(status))}
              </span>
              <span className="flex min-w-0 flex-col justify-center px-3 py-2 hover:bg-surface-alt">
                <PartsLine parts={parts} />
                <span className="text-xs text-ink-soft">
                  <span className="font-semibold text-ink tabular-nums">
                    {row.subjectId}
                  </span>{' '}
                  {name}
                </span>
              </span>
            </button>
            {needsAction(status) ? (
              <RowAction model={model} row={row} status={status} t={t} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
