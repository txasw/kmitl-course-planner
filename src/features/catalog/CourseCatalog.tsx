// The course catalog: a dedupe summary that reports the value of merging repeated
// rows, the filter bar, and the courses grouped by their subject type heading.
// Section states are computed against the placed sections read from the plan
// store, so the catalog is ready for the planner phase without rework.

import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';
import { RefreshCw } from 'lucide-react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { Course, Section } from '@/lib/domain/types';
import type { NormalizedCatalog } from '@/lib/domain/normalize';
import { asSemester, termsEqual, type Term } from '@/lib/routing/academicTerms';
import { computeSeatStatus } from '@/lib/catalog/seatStatus';
import {
  computeSectionRelation,
  type TermContext,
} from '@/lib/planner/sectionState';
import { filterCourses, type SectionPredicates } from '@/lib/catalog/filter';
import { useTranslation } from '@/features/shell/useTranslation';
import {
  usePlacedSections,
  useActivePlan,
  planStore,
} from '@/features/plans/planStore';
import { addSectionToPlan } from '@/features/plans/addToPlan';
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
  t,
}: {
  courses: number;
  sections: number;
  merged: number;
  t: Translate;
}) {
  return (
    <p className="text-xs text-ink-soft">
      {courses} {t('catalog.units.course')} {sections}{' '}
      {t('catalog.units.section')} {merged} {t('catalog.units.merged')}
    </p>
  );
}

interface CourseCatalogProps {
  catalog: NormalizedCatalog;
  onRefresh: () => void;
}

export function CourseCatalog({ catalog, onRefresh }: CourseCatalogProps) {
  const { t, language } = useTranslation();
  const placed = usePlacedSections();
  const activePlan = useActivePlan();
  const resultQuery = useStore(searchStore, (state) => state.resultQuery);
  const filter = useStore(catalogStore, (state) => state.filter);

  const term = useMemo<TermContext>(
    () => ({
      planTerm:
        activePlan === null
          ? null
          : { year: activePlan.year, semester: activePlan.semester },
      browsedTerm:
        resultQuery === null
          ? null
          : {
              year: resultQuery.selected_year,
              semester: asSemester(resultQuery.selected_semester),
            },
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
        dragStore
          .getState()
          .announce(`${t('feedback.added')} ${section.subjectId}`);
      } else if ('crossTerm' in outcome) {
        dragStore.getState().showCrossTerm({
          planTerm: outcome.crossTerm.planTerm,
          browsedTerm: outcome.crossTerm.incomingTerm,
        });
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

  const creditOptions = useMemo(
    () =>
      [...new Set(catalog.courses.map((course) => course.credit))].sort(
        (a, b) => a - b,
      ),
    [catalog.courses],
  );

  const totalSections = catalog.courses.reduce(
    (total, course) => total + course.sections.length,
    0,
  );

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
          className="rounded-kcp border border-primary bg-surface px-2 py-0.5 font-medium text-primary-strong outline-none hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('term.switch')}
        </button>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Summary
          courses={catalog.courses.length}
          sections={totalSections}
          merged={catalog.duplicateCount}
          t={t}
        />
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex shrink-0 items-center gap-1 rounded-kcp border border-border px-2 py-1 text-xs font-medium text-ink-soft hover:bg-surface-alt hover:text-ink focus:ring-2 focus:ring-primary focus:outline-none"
        >
          <RefreshCw size={12} strokeWidth={2} aria-hidden />
          {t('catalog.refresh')}
        </button>
      </div>
      {banner}
      <FilterBar creditOptions={creditOptions} />
      {groups.length === 0 ? (
        <p className="text-sm text-ink-soft">{t('catalog.filterEmpty')}</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
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
