// The section comparison: every section of one course side by side, so a student weighs
// times, places, instructors, seats, exams, conditions, and eligibility without reading a
// long column of stacked rows. From 768 px it opens as a modal dialog over the panel
// with a table of one row per section. Below that it opens as a full height bottom sheet
// with the table transposed, the fields as rows and the sections as columns, two side
// by side, because nine columns do not fit a phone. Either table owns its scroll on both
// axes, so its headers stay in view as a 44 section course scrolls under them. The
// student narrows the sections to those that can be added now and sorts them by the
// earliest start or by the most open seats. The status field reads the catalog row
// status, so the table and the card never disagree. Escape and the close button close
// the comparison only, and focus returns to the compare control that opened it.
// The add field adds a section through the normal add path, so the plan's own checks
// decide, and a blocked add states its reason in its cell. The modal hides the rest of the
// panel from assistive technology, the persistent live regions with it, so the table
// speaks its add outcomes in a polite node of its own, the scoped node the live region
// inventory of ADR-0048 allows a modal, and leaves the strip and the toast silent, so each
// outcome is read once. An add or a term switch turns the pressed control into a mark or
// drops its row from an addable only view, so focus moves on to the table.

import { useMemo, useRef, useState } from 'react';
import { ListFilter } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
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
  type ComparisonSort,
} from '@/lib/catalog/compareSections';
import type { TermContext } from '@/lib/planner/sectionState';
import {
  COMPARISON_TABLE_MIN_WIDTH,
  minWidthQuery,
} from '@/lib/ui/breakpoints';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { addSectionToPlan } from '@/features/plans/addToPlan';
import { planStore } from '@/features/plans/planStore';
import { activePlanOf } from '@/features/plans/planStoreState';
import { switchOrCreatePlanForTerm } from '@/features/plans/switchPlanTerm';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { useMediaQuery } from '@/features/shell/useMediaQuery';
import { addOutcomeText } from './ComparisonAddCell';
import { ComparisonTable } from './ComparisonTable';
import { ComparisonTransposed } from './ComparisonTransposed';

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
  const wide = useMediaQuery(minWidthQuery(COMPARISON_TABLE_MIN_WIDTH));
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
  const Layout = wide ? ComparisonTable : ComparisonTransposed;

  const body = (
    <>
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
        <Layout
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
    </>
  );

  return wide ? (
    <ModalDialog
      title={title}
      closeLabel={t('compare.close')}
      onClose={onClose}
      width="table"
      scroll="content"
    >
      {body}
    </ModalDialog>
  ) : (
    <BottomSheet
      title={title}
      closeLabel={t('compare.close')}
      onClose={onClose}
      fullHeight
      scroll="content"
    >
      {body}
    </BottomSheet>
  );
}
