// The entry points to plan suggestions (ADR-0054). The plan status row ends with a filled
// primary button in every edit view, in the thumb zone on a phone (ADR-0049 amendment), and it
// is always there, so the first run tour can point at it before any search (ADR-0074). The
// catalog head carries a second entry, filled too, only on the tiers where the status row is
// out of reach while the student reads the result: the phone catalog pane, and the medium tier
// sheet, which traps focus over the timetable. The docked column carries none, since the
// status row sits beside it.
//
// A suggestion means something only when the settled result is a by_class search, the search
// by curriculum and class year, it holds at least one curriculum course, and its term is the
// active plan's, or there is no plan yet. A category or subject id search mixes subjects from
// outside one curriculum, and a different term could not be added to the plan. Then the
// catalog entry is absent, and the status row entry opens a short dialog that says so and
// offers one action, the search by curriculum in the plan's term. Both carry a wand with
// sparkles, a glyph no other control uses, so the action never reads as the selected courses
// tab, whose icon is a checklist.

import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { SuggestDialog } from '@/features/planner/SuggestDialog';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useActivePlan } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { TARGET_SIZE } from '@/lib/ui/target';
import { tourTargetProps } from '@/lib/onboarding/tour';
import { openCurriculumSearch } from './revealCourse';
import { SuggestNeedsSearch } from './SuggestNeedsSearch';

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

/** Where the entry sits: the end of the plan status row, or the catalog head. */
export type SuggestActionPlacement = 'status' | 'catalog';

// The entry keeps its label on one line and never lets its neighbours squeeze it. An inset
// ring would vanish into the orange fill, so it takes the offset outline the other filled
// primary buttons use.
const FILLED_CLASS = `shrink-0 whitespace-nowrap border-primary-strong bg-primary-strong px-3 font-semibold text-surface hover:border-primary-hover hover:bg-primary-hover ${FOCUS_OUTLINE}`;

interface SuggestActionProps {
  placement: SuggestActionPlacement;
}

/** Which dialog the entry opened: the suggestions, or the note that a search comes first. */
type OpenDialog = 'suggest' | 'needsSearch' | null;

export function SuggestAction({ placement }: SuggestActionProps) {
  const { t } = useTranslation();
  const tier = useLayoutTier();
  const target = useSuggestTarget();
  const [open, setOpen] = useState<OpenDialog>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const status = placement === 'status';

  if (target === null && !status) {
    return null;
  }
  const handleSearch = () => {
    // The dialog closes first and hands focus back to this button, which the reveal then
    // moves on to the curriculum tab.
    flushSync(() => {
      setOpen(null);
    });
    if (buttonRef.current !== null) {
      openCurriculumSearch(buttonRef.current, tier);
    }
  };
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        {...(status ? tourTargetProps('suggest') : {})}
        onClick={() => {
          setOpen(target === null ? 'needsSearch' : 'suggest');
        }}
        className={`inline-flex items-center gap-1.5 rounded-kcp border py-1.5 text-sm transition-colors ${FILLED_CLASS} ${TARGET_SIZE}`}
      >
        <WandSparkles size={16} strokeWidth={2} aria-hidden />
        {t(status ? 'suggest.openShort' : 'suggest.open')}
      </button>
      {open === 'suggest' && target !== null ? (
        <SuggestDialog
          courses={target.courses}
          sourceQuery={target.sourceQuery}
          term={target.term}
          onClose={() => {
            setOpen(null);
          }}
        />
      ) : null}
      {open === 'needsSearch' ? (
        <SuggestNeedsSearch
          onClose={() => {
            setOpen(null);
          }}
          onSearch={handleSearch}
        />
      ) : null}
    </>
  );
}
