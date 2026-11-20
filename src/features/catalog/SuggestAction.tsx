// The entry point to plan suggestions (ADR-0054): a quiet button in the catalog column head,
// and a prominent one at the end of the plan status row, in the thumb zone on a phone
// (ADR-0049 amendment). Both open the same dialog, and both show only when a suggestion can
// mean something: the settled result is a by_class search, the search by curriculum and
// class year, it holds at least one curriculum course, and its term is the active plan's,
// or there is no plan yet. A category or subject id search mixes subjects from outside one
// curriculum, and a different term could not be added to the plan, so the action is absent
// rather than disabled in those cases. The icon is a neutral checklist, not a sparkle,
// since the result is a computed timetable.

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
export function useSuggestTarget(): SuggestTarget | null {
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

/** The quiet look of the catalog head, or the primary soft look of the plan status row. */
export type SuggestActionVariant = 'quiet' | 'prominent';

const VARIANT_CLASS: Record<SuggestActionVariant, string> = {
  quiet: 'border-border bg-surface px-2 text-ink hover:bg-surface-alt',
  // The status row keeps the label on one line and never lets its neighbours squeeze it.
  prominent:
    'shrink-0 whitespace-nowrap border-primary bg-primary-soft px-3 font-semibold text-primary-strong hover:bg-primary-strong hover:text-white',
};

interface SuggestActionProps {
  variant?: SuggestActionVariant;
}

export function SuggestAction({ variant = 'quiet' }: SuggestActionProps) {
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
        className={`inline-flex items-center gap-1.5 rounded-kcp border py-1.5 text-sm transition-colors ${VARIANT_CLASS[variant]} ${TARGET_SIZE} ${FOCUS_RING}`}
      >
        <ListChecks size={16} strokeWidth={2} aria-hidden />
        {t(variant === 'quiet' ? 'suggest.open' : 'suggest.openShort')}
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
