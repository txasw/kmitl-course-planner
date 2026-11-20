// The entry point to plan suggestions (ADR-0054): a quiet button in the catalog column
// head, and a prominent one at the end of the plan status row, a filled primary button in
// the thumb zone on a phone (ADR-0049 amendment). Both open the same dialog, and both show
// only when a suggestion can mean something: the settled result is a by_class search, the
// search by curriculum and class year, it holds at least one curriculum course, and its
// term is the active plan's, or there is no plan yet. A category or subject id search mixes
// subjects from outside one curriculum, and a different term could not be added to the
// plan, so the action is absent rather than disabled in those cases. Both carry a wand with
// sparkles, a glyph no other control uses, so the action never reads as the selected
// courses tab, whose icon is a checklist.

import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { WandSparkles } from 'lucide-react';
import { isCurriculumCourse } from '@/lib/catalog/subjectGroup';
import type { SourceQuery } from '@/lib/domain/plan';
import type { Course } from '@/lib/domain/types';
import {
  termFromQueryFields,
  termsEqual,
  type Term,
} from '@/lib/routing/academicTerms';
import { toSourceQuery } from '@/lib/planner/sourceQuery';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { SuggestDialog } from '@/features/planner/SuggestDialog';
import { useActivePlan } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { TARGET_SIZE } from '@/lib/ui/target';
import { tourTargetProps } from '@/lib/onboarding/tour';

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

/** The quiet look of the catalog head, or the filled primary look of the plan status row. */
export type SuggestActionVariant = 'quiet' | 'prominent';

const VARIANT_CLASS: Record<SuggestActionVariant, string> = {
  quiet: `border-border bg-surface px-2 text-ink hover:bg-surface-alt ${FOCUS_RING}`,
  // The status row keeps the label on one line and never lets its neighbours squeeze it.
  // An inset ring would vanish into the orange fill, so the filled look takes the offset
  // outline the other filled primary buttons use.
  prominent: `shrink-0 whitespace-nowrap border-primary-strong bg-primary-strong px-3 font-semibold text-surface hover:border-primary-hover hover:bg-primary-hover ${FOCUS_OUTLINE}`,
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
        {...(variant === 'prominent' ? tourTargetProps('suggest') : {})}
        onClick={() => {
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-kcp border py-1.5 text-sm transition-colors ${VARIANT_CLASS[variant]} ${TARGET_SIZE}`}
      >
        <WandSparkles size={16} strokeWidth={2} aria-hidden />
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
