// The queue of planned subjects on the helper card: one chip per subject in plan order,
// three to a row, each with its status icon and its full subject id. Settled subjects sit
// on the grey fill in regular weight, so the ones still to add read first in colour and in
// grey. The chip in focus carries the orange ring. The grid is one tab stop: the chip in
// focus holds it, the arrow keys move between chips, and Enter or Space puts a chip in
// focus. Each chip's name and tooltip carry the subject name, so the id is never the only
// identity. On a touch screen a tap would leave the tooltip up over the next chips, and
// the subject in focus names itself under the queue, so there the chips show none.

import type { KeyboardEvent } from 'react';
import { Tooltip } from '@/components/Tooltip';
import { pickLocalized } from '@/lib/i18n/localize';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ChecklistRow } from '@/lib/regis/checklist';
import {
  STATUS_TONE,
  isDone,
  type HelperStatus,
} from '@/lib/regis/helperStatus';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { focusFirst } from '@/features/shell/restoreFocus';
import { StatusIcon } from './StatusIcon';
import { TONE_ICON, bandKey } from './statusMeta';

interface QueueChipsProps {
  rows: readonly ChecklistRow[];
  statuses: Readonly<Record<string, HelperStatus>>;
  currentId: string | null;
  stale: boolean;
  /** Whether the pointer is coarse, where a tap would leave the tooltip up. */
  coarse: boolean;
  locale: Locale;
  t: Translate;
  onPick: (subjectId: string) => void;
}

const COLUMNS = 3;

const STEP: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -COLUMNS,
  ArrowDown: COLUMNS,
};

function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  const grid = event.currentTarget.closest('ul');
  if (grid === null) return;
  const chips = Array.from(grid.querySelectorAll('button'));
  const at = chips.indexOf(event.currentTarget);
  if (at < 0) return;
  const step = STEP[event.key];
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? chips.length - 1
        : step === undefined
          ? null
          : Math.min(chips.length - 1, Math.max(0, at + step));
  if (next === null) return;
  event.preventDefault();
  focusFirst([chips[next]]);
}

function chipLook(status: HelperStatus, current: boolean, stale: boolean) {
  if (current) return 'bg-surface ring-2 ring-primary ring-inset';
  if (stale) {
    return 'border border-dashed border-border-strong bg-surface';
  }
  return isDone(status)
    ? 'bg-surface-alt'
    : 'bg-surface ring-1 ring-border ring-inset';
}

export function QueueChips({
  rows,
  statuses,
  currentId,
  stale,
  coarse,
  locale,
  t,
  onPick,
}: QueueChipsProps) {
  return (
    <ul
      aria-label={t('regis.queue')}
      className="grid grid-cols-3 gap-1 px-3 pb-3"
    >
      {rows.map((row) => {
        const status = statuses[row.subjectId] ?? 'todo';
        const current = row.subjectId === currentId;
        const name = pickLocalized(row.nameTh, row.nameEn, locale);
        const done = isDone(status);
        return (
          <li key={row.subjectId} className="flex">
            <Tooltip label={name} placement="top" disabled={coarse}>
              {(triggerProps, ref) => (
                <button
                  ref={ref}
                  {...triggerProps}
                  type="button"
                  data-status={status}
                  aria-current={current || undefined}
                  aria-label={`${row.subjectId} ${name}, ${t(bandKey(status))}`}
                  tabIndex={current ? 0 : -1}
                  onClick={() => {
                    onPick(row.subjectId);
                  }}
                  onKeyDown={handleKeyDown}
                  className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-kcp-sm px-1 text-xs tabular-nums hover:bg-surface-alt max-sm:h-11 max-sm:text-sm pointer-coarse:h-11 transition-colors motion-reduce:transition-none ${
                    done || stale
                      ? 'font-normal text-ink-soft'
                      : 'font-semibold text-ink'
                  } ${chipLook(status, current, stale)} ${FOCUS_OUTLINE}`}
                >
                  <StatusIcon
                    status={status}
                    size={14}
                    className={
                      stale ? 'text-ink-muted' : TONE_ICON[STATUS_TONE[status]]
                    }
                  />
                  <span className="tracking-[0.01em]">{row.subjectId}</span>
                </button>
              )}
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
