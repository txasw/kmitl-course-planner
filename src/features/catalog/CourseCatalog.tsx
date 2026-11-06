// The course catalog: a dedupe summary that reports the value of merging repeated
// rows, the filter bar, and the courses grouped by their subject type heading.
// Section states are computed against the placed sections read from the plan
// store, so the catalog is ready for the planner phase without rework.

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  type MouseEvent,
} from 'react';
import { useStore } from 'zustand';
import { ChevronsDownUp, ChevronsUpDown, RefreshCw } from 'lucide-react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import {
  termFromQueryFields,
  termsEqual,
  type Term,
} from '@/lib/routing/academicTerms';
import { computeSeatStatus } from '@/lib/catalog/seatStatus';
import { countSections } from '@/lib/catalog/countSections';
import {
  computeSectionRelation,
  type TermContext,
} from '@/lib/planner/sectionState';
import { filterCourses, type SectionPredicates } from '@/lib/catalog/filter';
import {
  catalogQueryKey,
  isCardInstant,
  isCardOpen,
} from '@/lib/catalog/cardDisclosure';
import { FOCUS_RING } from '@/lib/ui/focus';
import { useTranslation } from '@/features/shell/useTranslation';
import {
  usePlacedSections,
  useActivePlan,
  planStore,
} from '@/features/plans/planStore';
import { addSectionToPlan, confirmAdd } from '@/features/plans/addToPlan';
import { switchOrCreatePlanForTerm } from '@/features/plans/switchPlanTerm';
import { searchStore } from '@/features/search/searchStore';
import { dragStore } from '@/features/planner/dragStore';
import { catalogStore } from './catalogStore';
import { CourseCard } from './CourseCard';
import { FilterBar } from './FilterBar';

interface HeadingGroup {
  key: string;
  heading: string;
  courses: Course[];
}

function groupByHeading(courses: Course[], locale: Locale): HeadingGroup[] {
  const groups: HeadingGroup[] = [];
  const index = new Map<string, HeadingGroup>();
  for (const course of courses) {
    const key = course.groupNameTh;
    let group = index.get(key);
    if (group === undefined) {
      const heading =
        locale === 'th'
          ? course.groupNameTh || course.groupNameEn
          : course.groupNameEn || course.groupNameTh;
      group = { key, heading, courses: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.courses.push(course);
  }
  return groups;
}

function Summary({
  courses,
  sections,
  merged,
  multiMeeting,
  t,
}: {
  courses: number;
  sections: number;
  merged: number;
  multiMeeting: number;
  t: Translate;
}) {
  return (
    <p className="text-xs text-ink-soft">
      {courses} {t('catalog.units.course')} {sections}{' '}
      {t('catalog.units.section')} {merged} {t('catalog.units.merged')}
      {multiMeeting > 0 ? (
        <>
          {' '}
          {multiMeeting} {t('catalog.units.multiMeeting')}
        </>
      ) : null}
    </p>
  );
}

// Collapse all unmounts every open body. A clicked button is not focused on every
// platform, so focus can still rest in a row that is about to go; it moves to that
// card's toggle first, read from the panel's root so a shadow root is searched.
function moveFocusOutOfCardBody(from: Element): void {
  const root = from.getRootNode();
  if (!(root instanceof ShadowRoot || root instanceof Document)) return;
  root.activeElement
    ?.closest('[data-course-body]')
    ?.closest('article')
    ?.querySelector<HTMLElement>('[data-course-toggle]')
    ?.focus();
}

const SUMMARY_ACTION = `inline-flex shrink-0 items-center gap-1 rounded-kcp border border-border px-2 py-1 text-xs text-ink-soft hover:bg-surface-alt hover:text-ink ${FOCUS_RING}`;

interface CourseCatalogProps {
  catalog: NormalizedCatalog;
  /** Called with the pressed control, which unmounts once the refresh starts loading. */
  onRefresh: (from: Element) => void;
}

export function CourseCatalog({ catalog, onRefresh }: CourseCatalogProps) {
  const { t, language } = useTranslation();
  const placed = usePlacedSections();
  const activePlan = useActivePlan();
  const resultQuery = useStore(searchStore, (state) => state.resultQuery);
  const filter = useStore(catalogStore, (state) => state.filter);
  const disclosure = useStore(catalogStore, (state) => state.disclosure);
  const queryKey = useMemo(() => catalogQueryKey(resultQuery), [resultQuery]);
  const addedIds = useMemo(
    () => new Set(placed.map((section) => section.subjectId)),
    [placed],
  );
  // A plan change makes a choice stale once its course's placement no longer matches,
  // so a card opened before an add is collapsed again after a later remove.
  useEffect(() => {
    catalogStore.getState().syncPlacement(addedIds);
  }, [addedIds]);
  // One course in the result, or a text filter naming a subject id exactly, opens that
  // card, so a subject id search and the reveal in the list show the sections at once.
  const singleCourse = catalog.courses.length === 1;
  const exactId = filter.text.trim();
  const isOpen = (course: Course): boolean =>
    isCardOpen(
      disclosure,
      queryKey,
      course.subjectId,
      addedIds.has(course.subjectId),
      singleCourse || exactId === course.subjectId,
    );
  const handleToggle = useCallback(
    (subjectId: string, open: boolean, added: boolean) => {
      catalogStore.getState().setCardOpen(queryKey, subjectId, { open, added });
    },
    [queryKey],
  );

  const term = useMemo<TermContext>(
    () => ({
      planTerm:
        activePlan === null
          ? null
          : { year: activePlan.year, semester: activePlan.semester },
      browsedTerm:
        resultQuery === null
          ? null
          : termFromQueryFields(
              resultQuery.selected_year,
              resultQuery.selected_semester,
            ),
    }),
    [activePlan, resultQuery],
  );
  const crossTerm =
    term.planTerm !== null &&
    term.browsedTerm !== null &&
    !termsEqual(term.planTerm, term.browsedTerm);

  const handleSwitchTerm = useCallback((target: Term) => {
    switchOrCreatePlanForTerm(target);
  }, []);

  const handleAdd = useCallback(
    (course: Course, section: Section) => {
      const outcome = addSectionToPlan(course, section);
      if (outcome.ok) {
        confirmAdd(section, t);
      } else if ('crossTerm' in outcome) {
        dragStore.getState().showCrossTerm(outcome.crossTerm);
      } else {
        dragStore.getState().showBlocked({
          course,
          section,
          conflicts: outcome.conflicts,
        });
      }
    },
    [t],
  );
  const handleRemove = useCallback((teachTableId: string) => {
    planStore.getState().remove(teachTableId);
  }, []);

  const predicates = useMemo<SectionPredicates>(
    () => ({
      isFull: (section) => computeSeatStatus(section).kind === 'full',
      isConflicting: (course, section) =>
        computeSectionRelation(placed, course, section, term).kind ===
        'conflicting',
    }),
    [placed, term],
  );

  const filtered = useMemo(
    () => filterCourses(catalog.courses, filter, predicates),
    [catalog.courses, filter, predicates],
  );

  const groups = useMemo(
    () => groupByHeading(filtered, language),
    [filtered, language],
  );

  // The control acts on the cards the filters show. A bulk change sets every card
  // without a transition, and the transition keeps input responsive while a dense
  // catalog mounts its rows.
  const anyOpen = filtered.some(isOpen);
  const handleToggleAll = (event: MouseEvent<HTMLButtonElement>) => {
    const open = !anyOpen;
    if (!open) moveFocusOutOfCardBody(event.currentTarget);
    const cards = filtered.map((course) => ({
      subjectId: course.subjectId,
      added: addedIds.has(course.subjectId),
    }));
    startTransition(() => {
      catalogStore.getState().setAllCards(queryKey, cards, open);
    });
  };

  const creditOptions = useMemo(
    () =>
      [...new Set(catalog.courses.map((course) => course.credit))].sort(
        (a, b) => a - b,
      ),
    [catalog.courses],
  );

  const totalSections = countSections(catalog.courses);

  const planTerm = term.planTerm;
  const browsedTerm = term.browsedTerm;
  const banner =
    crossTerm && planTerm !== null && browsedTerm !== null ? (
      <div className="flex flex-wrap items-center gap-2 rounded-kcp border border-warn bg-primary-soft px-2 py-1.5 text-xs text-ink">
        <span>
          {t('term.planIs')} {planTerm.semester}/{planTerm.year}.{' '}
          {t('term.browsedIs')} {browsedTerm.semester}/{browsedTerm.year}
        </span>
        <button
          type="button"
          onClick={() => {
            handleSwitchTerm(browsedTerm);
          }}
          className="rounded-kcp border border-primary bg-surface px-2 py-0.5 text-primary-strong outline-none hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('term.switch')}
        </button>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        data-catalog-summary
        className="flex items-center justify-between gap-2"
      >
        <Summary
          courses={catalog.courses.length}
          sections={totalSections}
          merged={catalog.duplicateCount}
          multiMeeting={catalog.multiMeetingCount}
          t={t}
        />
        <div className="flex shrink-0 items-center gap-2">
          {/* A one course result opens on its own, and an empty filter leaves
              nothing to act on, so the control shows only for a list. */}
          {singleCourse || filtered.length === 0 ? null : (
            <button
              type="button"
              onClick={handleToggleAll}
              className={`${SUMMARY_ACTION} min-h-6 min-w-6 pointer-coarse:min-h-11`}
            >
              {anyOpen ? (
                <ChevronsDownUp size={12} strokeWidth={2} aria-hidden />
              ) : (
                <ChevronsUpDown size={12} strokeWidth={2} aria-hidden />
              )}
              {t(anyOpen ? 'catalog.collapseAll' : 'catalog.expandAll')}
            </button>
          )}
          <button
            type="button"
            onClick={(event) => {
              onRefresh(event.currentTarget);
            }}
            className={SUMMARY_ACTION}
          >
            <RefreshCw size={12} strokeWidth={2} aria-hidden />
            {t('catalog.refresh')}
          </button>
        </div>
      </div>
      {banner}
      <FilterBar creditOptions={creditOptions} />
      {groups.length === 0 ? (
        <p className="text-sm text-ink-soft">{t('catalog.filterEmpty')}</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-ink-soft">
              {group.heading}
            </h3>
            {group.courses.map((course) => (
              <CourseCard
                key={course.subjectId}
                course={course}
                placed={placed}
                locale={language}
                t={t}
                term={term}
                open={isOpen(course)}
                instant={isCardInstant(disclosure, queryKey, course.subjectId)}
                onToggle={handleToggle}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onSwitchTerm={handleSwitchTerm}
              />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
