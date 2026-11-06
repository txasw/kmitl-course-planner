// The plan suggestion dialog of ADR-0054. It searches the curriculum courses of the
// current by_class result for timetables that fit beside the active plan, keeping the
// plan's entries as fixed constraints, and lists up to three as cards. The student picks
// an objective and a preference; every change searches again. Applying a card creates a
// new plan for the term, so the active plan is never rewritten, and the undo toast can
// take it back. It is a centered dialog on the medium and wide tiers and the bottom sheet
// on compact, holding the same body.

import { useId, useState } from 'react';
import { CalendarX2 } from 'lucide-react';
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
import type { SuggestObjective } from '@/lib/planner/suggestRank';
import type { SuggestPreference } from '@/lib/planner/suggestScore';
import { FOCUS_OUTLINE } from '@/lib/ui/focus';
import { planStore, useActivePlan } from '@/features/plans/planStore';
import { toastStore } from '@/features/shell/toastStore';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useTranslation } from '@/features/shell/useTranslation';
import { SuggestionCard } from './SuggestionCard';
import { useSuggestions } from './useSuggestions';
import { TARGET_SIZE } from '@/lib/ui/target';

const OBJECTIVES: readonly SuggestObjective[] = ['coverAll', 'maxCredits'];

const PREFERENCES: readonly SuggestPreference[] = [
  'balanced',
  'morning',
  'afternoon',
  'fewerDays',
  'compact',
];

const PREFERENCE_LABEL: Record<SuggestPreference, TranslationKey> = {
  balanced: 'suggest.pref.balanced',
  morning: 'suggest.pref.morning',
  afternoon: 'suggest.pref.afternoon',
  fewerDays: 'suggest.pref.fewerDays',
  compact: 'suggest.pref.compact',
};

const EMPTY_KEY: Record<SuggestEmptyReason, TranslationKey> = {
  allPlaced: 'suggest.empty.allPlaced',
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
        {PREFERENCES.map((preference) => {
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
  /** The courses of the current result; only its curriculum courses are chosen. */
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
  const [objective, setObjective] = useState<SuggestObjective>('coverAll');
  const [preference, setPreference] = useState<SuggestPreference>('balanced');
  const locked = useLockedEntries(term);
  const { result, busy } = useSuggestions(
    courses,
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

  const emptyReason = result === null ? null : suggestEmptyReason(result);
  const body = (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex flex-col gap-1 text-xs text-ink-soft">
        <p>{t('suggest.scope')}</p>
        {lockedSubjects > 0 ? (
          <p>{fillTemplate(t('suggest.locked'), { count: lockedSubjects })}</p>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <span className="text-xs text-ink-soft" aria-hidden>
          {t('suggest.objective')}
        </span>
        <SegmentedControl
          ariaLabel={t('suggest.objective')}
          value={objective}
          options={OBJECTIVES.map((value) => ({
            value,
            label: t(`suggest.objective.${value}`),
          }))}
          onChange={setObjective}
        />
      </div>
      <PreferenceChips value={preference} onChange={setPreference} t={t} />
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
          <ol
            className={`flex flex-col gap-3 transition-opacity duration-base motion-reduce:transition-none ${busy ? 'opacity-60' : ''}`}
          >
            {result.suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.choices
                  .map((choice) => choice.section.teachTableId)
                  .join(',')}
                suggestion={suggestion}
                index={index}
                locked={locked}
                locale={language}
                t={t}
                onApply={() => {
                  handleApply(suggestion);
                }}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );

  return tier === 'compact' ? (
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
    >
      {body}
    </ModalDialog>
  );
}
