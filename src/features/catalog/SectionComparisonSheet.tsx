// The section comparison table: every section of one course side by side, one row per
// section, so a student weighs times, places, instructors, seats, exams, conditions,
// and eligibility without reading a long column of stacked rows. It opens as a modal
// dialog over the panel. The table owns its scroll on both axes, so its header row and
// its section column stay in view while a 44 section course scrolls under them. The
// student narrows the rows to the sections that can be added now and sorts them by the
// earliest start or by the most open seats. The status column reads the catalog row
// status, so the table and the card never disagree. Escape and the close button close
// the table only, and focus returns to the compare control that opened it.

import { useMemo, useState } from 'react';
import { ListFilter } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ModalDialog } from '@/components/ModalDialog';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Switch } from '@/components/Switch';
import type { Course, Section } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import {
  compareSections,
  type ComparisonRow,
  type ComparisonSort,
} from '@/lib/catalog/compareSections';
import type { TermContext } from '@/lib/planner/sectionState';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import {
  ComparisonCells,
  COLUMN_HEADS,
  HEAD_CELL,
} from './SectionComparisonCells';

const SORTS: readonly ComparisonSort[] = ['start', 'seats'];

interface SectionComparisonSheetProps {
  course: Course;
  placed: Section[];
  locale: Locale;
  t: Translate;
  term: TermContext | undefined;
  onClose: () => void;
}

export function SectionComparisonSheet({
  course,
  placed,
  locale,
  t,
  term,
  onClose,
}: SectionComparisonSheetProps) {
  const [onlyAddable, setOnlyAddable] = useState(false);
  const [sort, setSort] = useState<ComparisonSort>('start');
  const rows = useMemo(
    () => compareSections(course, placed, term, { onlyAddable, sort }),
    [course, placed, term, onlyAddable, sort],
  );
  const name = locale === 'th' ? course.nameTh : course.nameEn;
  const title = fillTemplate(t('compare.title'), {
    subject: `${course.subjectId} ${name}`,
  });

  return (
    <ModalDialog
      title={title}
      closeLabel={t('compare.close')}
      onClose={onClose}
      width="table"
      scroll="content"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        {/* The switch fills its container, so a wrapper sized to its content keeps
            it beside the sort control instead of across the whole toolbar. */}
        <div className="shrink-0">
          <Switch
            checked={onlyAddable}
            label={t('compare.onlyAddable')}
            onChange={setOnlyAddable}
          />
        </div>
        <div className="flex items-center gap-2">
          {/* The group carries the same words as its name, so the visible label is
              not read twice. */}
          <span aria-hidden className="text-xs text-ink-soft">
            {t('compare.sort')}
          </span>
          <SegmentedControl
            ariaLabel={t('compare.sort')}
            value={sort}
            variant="quiet"
            options={SORTS.map((value) => ({
              value,
              label: t(`compare.sort.${value}`),
            }))}
            onChange={setSort}
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="py-6">
          <EmptyState
            icon={ListFilter}
            title={t('compare.empty.title')}
            description={t('compare.empty.description')}
            action={
              <button
                type="button"
                onClick={() => {
                  setOnlyAddable(false);
                }}
                className={`rounded-kcp border border-border px-3 py-1 text-sm text-ink hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`}
              >
                {t('compare.showAll')}
              </button>
            }
          />
        </div>
      ) : (
        <ComparisonTable rows={rows} title={title} locale={locale} t={t} />
      )}
    </ModalDialog>
  );
}

interface ComparisonTableProps {
  rows: ComparisonRow[];
  title: string;
  locale: Locale;
  t: Translate;
}

function ComparisonTable({ rows, title, locale, t }: ComparisonTableProps) {
  return (
    // The table holds no control, so the scroller is a tab stop of its own and a
    // keyboard user can scroll it with the arrow keys. The browser's implicit stop for
    // such a scroller is not enough: the dialog's focus trap wraps Tab from its last
    // control and only counts explicit stops, so it would skip the table. The ring
    // shows where focus is.
    <div
      role="region"
      aria-label={title}
      tabIndex={0}
      className={`kcp-scroll min-h-0 flex-1 overflow-auto rounded-kcp border border-border ${FOCUS_RING}`}
    >
      {/* Separate borders keep each cell's rule on the cell, so the rules travel with
          the sticky header and column instead of staying behind as they scroll. */}
      <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-xs">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {COLUMN_HEADS.map((head, index) => (
              <th
                key={head.key}
                scope="col"
                className={`${HEAD_CELL} ${head.width} ${index === 0 ? 'left-0 z-20' : 'z-10'}`}
              >
                {t(head.key)}
                {head.note === undefined ? null : (
                  <span className="block font-normal text-ink-soft">
                    {t(head.note)}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.section.teachTableId}>
              <ComparisonCells
                row={row}
                zebra={index % 2 === 1}
                locale={locale}
                t={t}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
