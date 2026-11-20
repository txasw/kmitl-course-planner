// The plan suggestion dialog of ADR-0054. It searches the courses the student ticks in
// the current by_class result, the curriculum courses by default, for timetables that
// fit beside the active plan, keeping the plan's entries as fixed constraints, and shows
// up to three, whose meeting times differ, one per slide of a carousel. The student ticks
// the subjects and picks an objective and a preference; every change searches again and
// returns the carousel to the best suggestion, and so does a change to the active plan. The ticks last for the dialog only, since a
// new result holds other courses. Applying a suggestion creates a new plan for the term,
// so the active plan is never rewritten, and the undo toast can take it back. The
// objective and the preference last used persist with the prefs, so the dialog opens on
// them. It is a centered dialog at the full width on the medium and docked tiers and the
// bottom sheet on compact.
//
// The slides share one frame and one grid orientation: time runs downward on compact,
// where the phone is tall and narrow, and across on every wider tier, the way the edit
// grid reads. A slide takes the full dialog width, so its grid reads in place and there is
// no separate full size view.

import { useId, useMemo, useState } from 'react';
import { CalendarX2 } from 'lucide-react';
import { useStore } from 'zustand';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { ModalDialog } from '@/components/ModalDialog';
import { SegmentedControl } from '@/components/SegmentedControl';
import type { PlanEntry, SourceQuery } from '@/lib/domain/plan';
import type { Course } from '@/lib/domain/types';
import type { Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import { termsEqual, type Term } from '@/lib/routing/academicTerms';
import { summarizeCredits } from '@/lib/planner/credits';
import type { Suggestion } from '@/lib/planner/suggest';
import {
  suggestEmptyReason,
  type SuggestEmptyReason,
} from '@/lib/planner/suggestEmpty';
import {
  defaultSuggestSubjects,
  suggestableCourses,
} from '@/lib/planner/suggestSubjects';
import {
  SUGGEST_OBJECTIVES,
  type SuggestObjective,
} from '@/lib/planner/suggestRank';
import {
  SUGGEST_PREFERENCES,
  type SuggestPreference,
} from '@/lib/planner/suggestScore';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { planStore, useActivePlan } from '@/features/plans/planStore';
import { toastStore } from '@/features/shell/toastStore';
import { uiStore } from '@/features/shell/uiStore';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useTranslation } from '@/features/shell/useTranslation';
import { sharedFrame, suggestionSections } from './suggestionFrame';
import { SuggestionCarousel, type SuggestionView } from './SuggestionCarousel';
import {
  DEFAULT_GROUP_OPEN,
  SuggestSubjects,
  type SuggestGroupOpen,
} from './SuggestSubjects';
import { useSuggestions } from './useSuggestions';
import { TARGET_SIZE } from '@/lib/ui/target';

const PREFERENCE_LABEL: Record<SuggestPreference, TranslationKey> = {
  balanced: 'suggest.pref.balanced',
  morning: 'suggest.pref.morning',
  afternoon: 'suggest.pref.afternoon',
  fewerDays: 'suggest.pref.fewerDays',
  compact: 'suggest.pref.compact',
};

const EMPTY_KEY: Record<SuggestEmptyReason, TranslationKey> = {
  allPlaced: 'suggest.empty.allPlaced',
  noneTicked: 'suggest.empty.noneTicked',
  seats: 'suggest.empty.seats',
  conflicts: 'suggest.empty.conflicts',
};

const NO_ENTRIES: readonly PlanEntry[] = [];

/** The entries a suggestion keeps: the active plan's, when it shares the term. */
function useLockedEntries(term: Term): readonly PlanEntry[] {
  const active = useActivePlan();
  return active !== null &&
    termsEqual({ year: active.year, semester: active.semester }, term)
    ? active.entries
    : NO_ENTRIES;
}

function PreferenceChips({
  value,
  onChange,
  t,
}: {
  value: SuggestPreference;
  onChange: (value: SuggestPreference) => void;
  t: Translate;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-xs text-ink-soft">
        {t('suggest.preference')}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-1.5"
      >
        {SUGGEST_PREFERENCES.map((preference) => {
          const active = preference === value;
          return (
            <button
              key={preference}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChange(preference);
              }}
              className={`rounded-full px-3 py-1 text-xs ${TARGET_SIZE} ${
                active
                  ? 'bg-primary-strong text-surface'
                  : 'bg-surface-alt text-ink-soft hover:text-ink'
              } ${FOCUS_OUTLINE}`}
            >
              {t(PREFERENCE_LABEL[preference])}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingCards({ t }: { t: Translate }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('suggest.loading')}
      className="flex flex-col gap-3"
    >
      {[0, 1].map((row) => (
        <div
          key={row}
          className="h-48 animate-pulse rounded-kcp bg-surface-alt motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

interface SuggestDialogProps {
  /** The courses of the current result; only the ticked ones are chosen. */
  courses: readonly Course[];
  /** The query of that result, stamped on every entry the suggestion adds. */
  sourceQuery: SourceQuery;
  /** The term of that result, which the created plan takes. */
  term: Term;
  onClose: () => void;
}

export function SuggestDialog({
  courses,
  sourceQuery,
  term,
  onClose,
}: SuggestDialogProps) {
  const { t, language } = useTranslation();
  const tier = useLayoutTier();
  const objective = useStore(uiStore, (state) => state.suggestObjective);
  const preference = useStore(uiStore, (state) => state.suggestPreference);
  const locked = useLockedEntries(term);
  // The shown slide, held with the plan entries it was ranked against. A plan change ranks
  // the suggestions again, so slide 2 would show another suggestion with no notice; the
  // carousel returns to the best one instead, as a new tick does.
  const [paging, setPaging] = useState(() => ({ page: 0, locked }));
  const page = paging.locked === locked ? paging.page : 0;
  const setPage = (next: number) => {
    setPaging({ page: next, locked });
  };
  const groups = useMemo(
    () => suggestableCourses(courses, locked),
    [courses, locked],
  );
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() =>
    defaultSuggestSubjects(courses, locked),
  );
  const [groupOpen, setGroupOpen] =
    useState<SuggestGroupOpen>(DEFAULT_GROUP_OPEN);
  const { result, busy } = useSuggestions(
    courses,
    ticked,
    locked,
    objective,
    preference,
  );
  const lockedSubjects = summarizeCredits(
    locked.map((entry) => ({
      subjectId: entry.subjectId,
      credit: entry.snapshot.subjectMeta.credit,
    })),
  ).subjects;
  const cards = useMemo<SuggestionView[]>(
    () =>
      (result?.suggestions ?? []).map((suggestion) => ({
        suggestion,
        sections: suggestionSections(locked, suggestion),
      })),
    [result, locked],
  );
  const frame = useMemo(
    () => sharedFrame(cards.map((card) => card.sections)),
    [cards],
  );

  const compact = tier === 'compact';
  const orientation = compact ? 'portrait' : 'landscape';
  const current = Math.min(page, Math.max(0, cards.length - 1));

  // New ticks, a new objective, or a new preference rank the suggestions again, so the
  // carousel returns to the best.
  const handleTicked = (next: ReadonlySet<string>) => {
    setTicked(next);
    setPage(0);
  };
  const handleObjective = (value: SuggestObjective) => {
    uiStore.getState().setSuggestObjective(value);
    setPage(0);
  };
  const handlePreference = (value: SuggestPreference) => {
    uiStore.getState().setSuggestPreference(value);
    setPage(0);
  };
  const handleApply = (suggestion: Suggestion) => {
    const plan = planStore.getState().createFromSuggestion({
      name: fillTemplate(t('suggest.planName'), {
        term: `${term.semester}/${term.year}`,
        preference: t(PREFERENCE_LABEL[preference]),
      }),
      term,
      suggestion,
      sourceQuery,
    });
    if (plan === null) {
      toastStore.getState().show('error', t('suggest.applyFailed'));
      return;
    }
    onClose();
  };

  const tickable = [...groups.curriculum, ...groups.other];
  const emptyReason =
    result === null
      ? null
      : suggestEmptyReason(result, {
          tickable: tickable.length,
          ticked: tickable.filter((course) => ticked.has(course.subjectId))
            .length,
        });
  const body = (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex flex-col gap-1 text-xs text-ink-soft">
        <p>{t('suggest.scope')}</p>
        {lockedSubjects > 0 ? (
          <p>{fillTemplate(t('suggest.locked'), { count: lockedSubjects })}</p>
        ) : null}
      </div>
      <SuggestSubjects
        groups={groups}
        ticked={ticked}
        onChange={handleTicked}
        open={groupOpen}
        onOpenChange={setGroupOpen}
        locale={language}
        t={t}
      />
      <div className="flex flex-col items-start gap-1.5">
        <span className="text-xs text-ink-soft" aria-hidden>
          {t('suggest.objective')}
        </span>
        <SegmentedControl
          ariaLabel={t('suggest.objective')}
          value={objective}
          options={SUGGEST_OBJECTIVES.map((value) => ({
            value,
            label: t(`suggest.objective.${value}`),
          }))}
          onChange={handleObjective}
        />
      </div>
      <PreferenceChips value={preference} onChange={handlePreference} t={t} />
      {result === null ? (
        busy ? (
          <LoadingCards t={t} />
        ) : null
      ) : emptyReason !== null ? (
        <EmptyState
          icon={CalendarX2}
          title={t('suggest.empty.title')}
          description={t(EMPTY_KEY[emptyReason])}
        />
      ) : (
        <section aria-label={t('suggest.results')} aria-busy={busy}>
          {result.truncated ? (
            <p className="mb-3 rounded-kcp border border-warn bg-surface-alt px-2 py-1.5 text-xs text-ink">
              {t('suggest.truncated')}
            </p>
          ) : null}
          <SuggestionCarousel
            cards={cards}
            frame={frame}
            orientation={orientation}
            page={current}
            onPageChange={setPage}
            busy={busy}
            locale={language}
            t={t}
            onApply={handleApply}
          />
        </section>
      )}
    </div>
  );

  return compact ? (
    <BottomSheet
      title={t('suggest.title')}
      closeLabel={t('suggest.close')}
      onClose={onClose}
    >
      {body}
    </BottomSheet>
  ) : (
    <ModalDialog
      title={t('suggest.title')}
      closeLabel={t('suggest.close')}
      onClose={onClose}
      width="full"
    >
      {body}
    </ModalDialog>
  );
}
