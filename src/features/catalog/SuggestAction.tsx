// The entry point to plan suggestions in the catalog column head (ADR-0054). It shows
// only when a suggestion can mean something: the settled result is a by_class search,
// the search by curriculum and class year, it holds at least one curriculum course, and
// its term is the active plan's, or there is no plan yet. A category or subject id search
// mixes subjects from outside one curriculum, and a different term could not be added to
// the plan, so the action is absent rather than disabled in those cases. The icon is a
// neutral checklist, not a sparkle, since the result is a computed timetable.

import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { ListChecks } from 'lucide-react';
import { isCurriculumCourse } from '@/lib/catalog/subjectGroup';
import type { SourceQuery } from '@/lib/domain/plan';
import type { Course } from '@/lib/domain/types';
import {
  termFromQueryFields,
  termsEqual,
  type Term,
} from '@/lib/routing/academicTerms';
import { toSourceQuery } from '@/lib/planner/sourceQuery';
import { FOCUS_RING } from '@/lib/ui/focus';
import { SuggestDialog } from '@/features/planner/SuggestDialog';
import { useActivePlan } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { TARGET_SIZE } from '@/lib/ui/target';

interface SuggestTarget {
  courses: readonly Course[];
  sourceQuery: SourceQuery;
  term: Term;
}

/** What a suggestion would search, or null when the action does not apply. */
function useSuggestTarget(): SuggestTarget | null {
  const result = useStore(searchStore, (state) => state.result);
  const query = useStore(searchStore, (state) => state.resultQuery);
  const active = useActivePlan();
  const planYear = active?.year ?? null;
  const planSemester = active?.semester ?? null;

  return useMemo(() => {
    if (
      result.status !== 'ready' ||
      query?.mode !== 'by_class' ||
      !result.data.courses.some(isCurriculumCourse)
    ) {
      return null;
    }
    const term = termFromQueryFields(
      query.selected_year,
      query.selected_semester,
    );
    if (term === null) {
      return null;
    }
    if (
      planYear !== null &&
      planSemester !== null &&
      !termsEqual(term, { year: planYear, semester: planSemester })
    ) {
      return null;
    }
    return {
      courses: result.data.courses,
      sourceQuery: toSourceQuery(query),
      term,
    };
  }, [result, query, planYear, planSemester]);
}

export function SuggestAction() {
  const { t } = useTranslation();
  const target = useSuggestTarget();
  const [open, setOpen] = useState(false);

  if (target === null) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-kcp border border-border bg-surface px-2 py-1.5 text-sm text-ink transition-colors hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`}
      >
        <ListChecks size={16} strokeWidth={2} aria-hidden />
        {t('suggest.open')}
      </button>
      {open ? (
        <SuggestDialog
          courses={target.courses}
          sourceQuery={target.sourceQuery}
          term={target.term}
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
