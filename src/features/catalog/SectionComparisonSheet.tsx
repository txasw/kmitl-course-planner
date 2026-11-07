// The section comparison table: every section of one course side by side, one row per
// section, so a student weighs times, places, instructors, seats, exams, conditions,
// and eligibility without reading a long column of stacked rows. It opens as a modal
// dialog over the panel. The table owns its scroll on both axes, so its header row and
// its section column stay in view while a 44 section course scrolls under them. The
// student narrows the rows to the sections that can be added now and sorts them by the
// earliest start or by the most open seats. The status column reads the catalog row
// status, so the table and the card never disagree. Escape and the close button close
// the table only, and focus returns to the compare control that opened it.
// The last column adds a section through the normal add path, so the plan's own checks
// decide, and a blocked add states its reason in the row. The modal hides the rest of the
// panel from assistive technology, the persistent live regions with it, so the table
// speaks its add outcomes in a polite node of its own, the scoped node the live region
// inventory of ADR-0048 allows a modal, and leaves the strip and the toast silent, so each
// outcome is read once. An add or a term switch turns the pressed control into a mark or
// drops its row from an addable only view, so focus moves on to the table.

import { useMemo, useRef, useState, type RefObject } from 'react';
import { ListFilter } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ModalDialog } from '@/components/ModalDialog';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Switch } from '@/components/Switch';
import type { Course, Section } from '@/lib/domain/types';
import type { Term } from '@/lib/routing/academicTerms';
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
import { addSectionToPlan } from '@/features/plans/addToPlan';
import { planStore } from '@/features/plans/planStore';
import { activePlanOf } from '@/features/plans/planStoreState';
import { switchOrCreatePlanForTerm } from '@/features/plans/switchPlanTerm';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { addOutcomeText, ComparisonAddCell } from './ComparisonAddCell';
import {
  ComparisonCells,
  COLUMN_HEADS,
  HEAD_CELL,
  headPinClass,
} from './SectionComparisonCells';

interface Announcement {
  id: number;
  text: string;
}

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
  const [blockedId, setBlockedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const showAllRef = useRef<HTMLButtonElement>(null);
  const rows = useMemo(
    () => compareSections(course, placed, term, { onlyAddable, sort }),
    [course, placed, term, onlyAddable, sort],
  );
  const name = locale === 'th' ? course.nameTh : course.nameEn;
  const title = fillTemplate(t('compare.title'), {
    subject: `${course.subjectId} ${name}`,
  });
  // Each outcome replaces the node's child, so the same words said twice are read twice.
  const announce = (text: string) => {
    setAnnouncement((current) => ({ id: (current?.id ?? 0) + 1, text }));
  };
  // The table stays put as rows change state; it is gone only when an addable only view
  // empties, and then the action that shows every section takes over.
  const tableTargets = () => [scrollerRef.current, showAllRef.current];

  const handleAdd = (section: Section) => {
    commitThenFocus(
      () => {
        const outcome = addSectionToPlan(course, section);
        const blocked = !outcome.ok && !('crossTerm' in outcome);
        setBlockedId(blocked ? section.teachTableId : null);
        announce(addOutcomeText(outcome, section, t));
        return blocked;
      },
      // A blocked add keeps its button, which keeps focus.
      (blocked) => (blocked ? [] : tableTargets()),
    );
  };
  const handleSwitchTerm = (target: Term) => {
    commitThenFocus(() => {
      switchOrCreatePlanForTerm(target);
      setBlockedId(null);
      const plan = activePlanOf(planStore.getState());
      if (plan !== undefined) {
        announce(fillTemplate(t('compare.switched'), { plan: plan.name }));
      }
    }, tableTargets);
  };

  return (
    <ModalDialog
      title={title}
      closeLabel={t('compare.close')}
      onClose={onClose}
      width="table"
      scroll="content"
    >
      <div role="status" className="sr-only">
        {announcement === null ? null : (
          <span key={announcement.id}>{announcement.text}</span>
        )}
      </div>
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
                ref={showAllRef}
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
        <ComparisonTable
          rows={rows}
          title={title}
          locale={locale}
          t={t}
          blockedId={blockedId}
          scrollerRef={scrollerRef}
          onAdd={handleAdd}
          onSwitchTerm={handleSwitchTerm}
        />
      )}
    </ModalDialog>
  );
}

interface ComparisonTableProps {
  rows: ComparisonRow[];
  title: string;
  locale: Locale;
  t: Translate;
  /** The section whose last add was blocked, whose cell states the reason. */
  blockedId: string | null;
  scrollerRef: RefObject<HTMLDivElement | null>;
  onAdd: (section: Section) => void;
  onSwitchTerm: (term: Term) => void;
}

function ComparisonTable({
  rows,
  title,
  locale,
  t,
  blockedId,
  scrollerRef,
  onAdd,
  onSwitchTerm,
}: ComparisonTableProps) {
  return (
    // The scroller is a tab stop of its own, so a keyboard user can scroll it with the
    // arrow keys even when no row holds a control, and an add or a switch that removes
    // its control hands focus to it. The browser's implicit stop for a scroller is not
    // enough: the dialog's focus trap only counts explicit stops. The ring shows where
    // focus is.
    <div
      ref={scrollerRef}
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
            {COLUMN_HEADS.map((head) => (
              <th
                key={head.key}
                scope="col"
                className={`${HEAD_CELL} ${head.width} ${headPinClass(head.pin)}`}
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
              <ComparisonAddCell
                row={row}
                surface={index % 2 === 1 ? 'bg-surface-alt' : 'bg-surface'}
                blocked={row.section.teachTableId === blockedId}
                t={t}
                onAdd={onAdd}
                onSwitchTerm={onSwitchTerm}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
