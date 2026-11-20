// The course catalog: the filter row, a one line result summary that also reports the
// value of merging repeated rows, and the courses grouped by their subject type heading,
// each heading a disclosure and each group in the chosen sort order. The summary is the
// one place the result's course count shows in the catalog column; the query chip above
// and the sheet header leave it out, so the count is read once.
// Section states are computed against the placed sections read from the plan
// store, so the catalog is ready for the planner phase without rework.

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent,
} from 'react';
import { useStore } from 'zustand';
import {
  BookOpen,
  CalendarRange,
  ChevronsDownUp,
  ChevronsUpDown,
  Merge,
  Rows3,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import {
  COURSE_UNIT,
  MERGED_UNIT,
  MULTI_MEETING_UNIT,
  SECTION_UNIT,
  countWithUnit,
  courseCountLabel,
  sectionCountLabel,
} from '@/lib/i18n/counts';
import type { Locale, Translate } from '@/lib/i18n/t';
import { termMismatchText } from '@/lib/i18n/termCopy';
import { fillTemplate } from '@/lib/i18n/template';
import type { Course, Section } from '@/lib/domain/types';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import type { AddOutcome } from '@/lib/planner/transaction';
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
import { sortCourses, type CourseSortKey } from '@/lib/catalog/sortCourses';
import { courseGroupKey, isGroupCollapsed } from '@/lib/catalog/groupCollapse';
import {
  catalogQueryKey,
  isCardInstant,
  isCardOpen,
} from '@/lib/catalog/cardDisclosure';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { useTranslation } from '@/features/shell/useTranslation';
import {
  usePlacedSections,
  useActivePlan,
  planStore,
} from '@/features/plans/planStore';
import { addSectionToPlan, confirmAdd } from '@/features/plans/addToPlan';
import { switchOrCreatePlanForTerm } from '@/features/plans/switchPlanTerm';
import { TermSwitchLabel } from '@/features/plans/TermSwitchLabel';
import { searchStore } from '@/features/search/searchStore';
import { dragStore } from '@/features/planner/dragStore';
import { firstFeedbackAction } from '@/features/planner/feedbackAction';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { rootOf } from '@/features/shell/useFocusTrap';
import { courseToggle } from './courseFocus';
import { catalogStore } from './catalogStore';
import { CatalogGroup } from './CatalogGroup';
import { CourseCard } from './CourseCard';
import { FilterBar } from './FilterBar';
import { useFilterAnnouncement } from './useFilterAnnouncement';

interface HeadingGroup {
  key: string;
  heading: string;
  courses: Course[];
}

// The headings keep the order the result gives them; the sort applies within each.
function groupByHeading(
  courses: Course[],
  locale: Locale,
  sort: CourseSortKey,
): HeadingGroup[] {
  const groups: HeadingGroup[] = [];
  const index = new Map<string, HeadingGroup>();
  for (const course of courses) {
    const key = courseGroupKey(course);
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
  return groups.map((group) => ({
    ...group,
    courses: sortCourses(group.courses, sort),
  }));
}

interface SummaryItem {
  icon: LucideIcon;
  text: string;
}

// Each figure leads with an icon and keeps its unit word, since a bare number does not
// say what it counts. The items wrap as whole words at any width.
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
  const items: SummaryItem[] = [
    { icon: BookOpen, text: countWithUnit(t, courses, COURSE_UNIT) },
    { icon: Rows3, text: countWithUnit(t, sections, SECTION_UNIT) },
    { icon: Merge, text: countWithUnit(t, merged, MERGED_UNIT) },
    ...(multiMeeting > 0
      ? [
          {
            icon: CalendarRange,
            text: countWithUnit(t, multiMeeting, MULTI_MEETING_UNIT),
          },
        ]
      : []),
  ];
  return (
    <p
      data-catalog-summary
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft tabular-nums"
    >
      {items.map(({ icon: Icon, text }) => (
        <span key={text} className="inline-flex items-center gap-1">
          <Icon size={14} strokeWidth={2} aria-hidden className="shrink-0" />
          {text}
        </span>
      ))}
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

/** Where focus goes after an add from the catalog, by its outcome. */
function addFocusTargets(
  scope: HTMLElement | null,
  course: Course,
  outcome: AddOutcome,
): (HTMLElement | null)[] {
  if (scope === null) return [];
  if (outcome.ok) return [courseToggle(scope, course.subjectId)];
  const root = rootOf(scope);
  return root === null ? [] : [firstFeedbackAction(root)];
}

const ICON_ACTION = `inline-flex shrink-0 items-center justify-center rounded-kcp text-ink hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`;

interface CourseCatalogProps {
  catalog: NormalizedCatalog;
}

export function CourseCatalog({ catalog }: CourseCatalogProps) {
  const { t, language } = useTranslation();
  const placed = usePlacedSections();
  const activePlan = useActivePlan();
  const resultQuery = useStore(searchStore, (state) => state.resultQuery);
  const filter = useStore(catalogStore, (state) => state.filter);
  const disclosure = useStore(catalogStore, (state) => state.disclosure);
  const sort = useStore(catalogStore, (state) => state.sort);
  const groupCollapse = useStore(catalogStore, (state) => state.groups);
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

  // An add or a remove from a row or the card header unmounts the control that was
  // pressed, so focus moves on in the same commit: to the card's toggle, which stays in
  // place as the card collapses or turns addable again, or, after a blocked or cross
  // term add, to the first action of the feedback strip, which offers the way forward.
  const rootRef = useRef<HTMLDivElement>(null);
  const handleAdd = useCallback(
    (course: Course, section: Section) => {
      commitThenFocus(
        () => {
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
          return outcome;
        },
        (outcome) => addFocusTargets(rootRef.current, course, outcome),
      );
    },
    [t],
  );
  const handleRemove = useCallback((teachTableId: string) => {
    const removed = planStore
      .getState()
      .entries.find((entry) => entry.teachTableId === teachTableId);
    commitThenFocus(
      () => {
        planStore.getState().remove(teachTableId);
      },
      () => {
        const scope = rootRef.current;
        return scope === null || removed === undefined
          ? []
          : [courseToggle(scope, removed.subjectId)];
      },
    );
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
    () => groupByHeading(filtered, language, sort),
    [filtered, language, sort],
  );
  useFilterAnnouncement(
    filter,
    filtered.length === 0
      ? t('catalog.filterEmpty')
      : fillTemplate(t('status.filterResults'), {
          courses: courseCountLabel(t, filtered.length),
          sections: sectionCountLabel(t, countSections(filtered)),
        }),
  );
  const isCollapsed = (group: HeadingGroup): boolean =>
    isGroupCollapsed(groupCollapse, queryKey, group.key);
  const handleToggleGroup = (group: HeadingGroup) => {
    catalogStore
      .getState()
      .setGroupCollapsed(queryKey, group.key, !isCollapsed(group));
  };

  // The control acts on the cards the filters show under an expanded heading. A bulk
  // change sets every card without a transition, and the transition keeps input
  // responsive while a dense catalog mounts its rows.
  const shown = groups.flatMap((group) =>
    isCollapsed(group) ? [] : group.courses,
  );
  const anyOpen = shown.some(isOpen);
  const handleToggleAll = (event: MouseEvent<HTMLButtonElement>) => {
    const open = !anyOpen;
    if (!open) moveFocusOutOfCardBody(event.currentTarget);
    const cards = shown.map((course) => ({
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
      <div className="flex flex-wrap items-center gap-2 rounded-kcp border border-warn bg-primary-soft px-2 py-2 text-xs text-ink">
        <span>{termMismatchText(planTerm, browsedTerm, 'browsing', t)}</span>
        <button
          type="button"
          onClick={() => {
            handleSwitchTerm(browsedTerm);
          }}
          className={`rounded-kcp border border-primary bg-surface px-2 py-1 text-primary-strong hover:bg-primary-soft ${FOCUS_RING}`}
        >
          <TermSwitchLabel term={browsedTerm} t={t} />
        </button>
      </div>
    ) : null;

  const toggleAllLabel = t(
    anyOpen ? 'catalog.collapseAll' : 'catalog.expandAll',
  );
  const ToggleAllIcon = anyOpen ? ChevronsDownUp : ChevronsUpDown;

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <FilterBar creditOptions={creditOptions}>
        {/* A one course result opens on its own, and an empty filter or collapsed
            headings leave nothing to act on, so the control shows only for a list. */}
        {singleCourse || shown.length === 0 ? null : (
          <Tooltip label={toggleAllLabel}>
            {(triggerProps, ref) => (
              <button
                ref={ref}
                {...triggerProps}
                type="button"
                aria-label={toggleAllLabel}
                onClick={handleToggleAll}
                className={ICON_ACTION}
              >
                <ToggleAllIcon size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
          </Tooltip>
        )}
      </FilterBar>
      {banner}
      <Summary
        courses={catalog.courses.length}
        sections={totalSections}
        merged={catalog.duplicateCount}
        multiMeeting={catalog.multiMeetingCount}
        t={t}
      />
      {groups.length === 0 ? (
        <p className="text-sm text-ink-soft">{t('catalog.filterEmpty')}</p>
      ) : (
        groups.map((group) => (
          <CatalogGroup
            key={group.key}
            heading={group.heading}
            count={
              // The summary line already counts every course, so a heading that holds
              // them all would repeat it; a count that differs still says something.
              group.courses.length === catalog.courses.length
                ? null
                : group.courses.length
            }
            collapsed={isCollapsed(group)}
            onToggle={() => {
              handleToggleGroup(group);
            }}
            t={t}
          >
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
          </CatalogGroup>
        ))
      )}
    </div>
  );
}
