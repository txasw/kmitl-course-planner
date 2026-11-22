// The change section disclosure of a placed subject (ADR-0068), in the block details and
// on each card of the selected courses view, so a keyboard, touch, or screen reader user
// reaches the move a block drag commits. Opened, it lists the subject's other section
// groups that are open and fit the plan once the current one leaves, a pair as one
// choice, soonest first, each showing its section, meetings, places, seats, and
// instructors as separate parts (ChangeOptionRow). A choice moves the subject through the
// same transaction a drag does, so the change is atomic and leaves one undo. The subject's other sections come
// from the current catalog, since a plan snapshot does not carry them; when the catalog
// does not list the subject in the plan's term, the list says to search for it first.

import { useId, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import { useStore } from 'zustand';
import type { PlanEntry } from '@/lib/domain/plan';
import type { Course } from '@/lib/domain/types';
import type { Locale, Translate } from '@/lib/i18n/t';
import { changeOptions, type ChangeOption } from '@/lib/planner/sectionChange';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import { moveSectionInPlan } from '@/features/plans/addToPlan';
import { planStore } from '@/features/plans/planStore';
import { searchStore } from '@/features/search/searchStore';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { rootOf } from '@/features/shell/useFocusTrap';
import { ChangeOptionRow } from './ChangeOptionRow';
import { dragStore } from './dragStore';
import { resolveCourseForSubject } from './resolveCourse';

type FocusTarget = HTMLElement | null | undefined;

interface ChangeSectionListProps {
  /** A placed entry of the subject; a pair moves from either half. */
  entry: PlanEntry;
  /** The language whose instructor names each choice lists. */
  locale: Locale;
  t: Translate;
  /** Size the controls as 44 px touch targets, for the bottom sheet. */
  touch?: boolean;
  /**
   * Where focus lands once a change commits, read after the commit, best first. The
   * disclosure toggle follows as the last resort, for a surface it outlives.
   */
  focusAfterChange?: (
    root: Document | ShadowRoot,
    added: PlanEntry[],
  ) => FocusTarget[];
}

const CONTROL = `inline-flex items-center gap-1.5 rounded-kcp border border-border bg-surface px-2 text-left text-ink hover:bg-surface-alt ${FOCUS_RING}`;

function controlSize(touch: boolean): string {
  return touch ? 'min-h-11 text-sm' : `${TARGET_HEIGHT} text-xs`;
}

interface ChangeOptionsProps {
  entry: PlanEntry;
  locale: Locale;
  t: Translate;
  touch: boolean;
  onChange: (
    control: HTMLElement,
    course: Course,
    option: ChangeOption,
  ) => void;
}

function ChangeOptions({
  entry,
  locale,
  t,
  touch,
  onChange,
}: ChangeOptionsProps) {
  const labelId = useId();
  const entries = useStore(planStore, (state) => state.entries);
  // The lookup reads the result and the active plan's term, so it reruns on any search
  // change, and the plan subscription above reruns it on a plan change.
  const course = useStore(searchStore, () =>
    resolveCourseForSubject(entry.subjectId),
  );
  if (course === null) {
    return <p className="text-xs text-ink-soft">{t('change.unavailable')}</p>;
  }
  const options = changeOptions(entries, course, entry.teachTableId);
  if (options.length === 0) {
    return <p className="text-xs text-ink-soft">{t('change.none')}</p>;
  }
  return (
    <>
      <p id={labelId} className="text-xs text-ink-soft">
        {t('change.listLabel')}
      </p>
      <ul aria-labelledby={labelId} className="flex flex-col gap-1.5">
        {options.map((option) => (
          <li key={option.section.teachTableId}>
            <ChangeOptionRow
              group={option.group}
              locale={locale}
              t={t}
              touch={touch}
              onSelect={(control) => {
                onChange(control, course, option);
              }}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

export function ChangeSectionList({
  entry,
  locale,
  t,
  touch = false,
  focusAfterChange,
}: ChangeSectionListProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  const handleChange = (
    control: HTMLElement,
    course: Course,
    option: ChangeOption,
  ) => {
    const root = rootOf(control);
    commitThenFocus(
      () => {
        const outcome = moveSectionInPlan(
          entry.teachTableId,
          course,
          option.section,
        );
        const drag = dragStore.getState();
        if (outcome.ok) {
          setOpen(false);
        } else if ('crossTerm' in outcome) {
          drag.showCrossTerm(outcome.crossTerm);
        } else if (outcome.conflicts.length > 0) {
          drag.showBlocked({
            course,
            section: option.section,
            conflicts: outcome.conflicts,
          });
        }
        return outcome;
      },
      (outcome) => {
        // A refused change leaves the list and its focus where they are.
        if (!outcome.ok || root === null) return [];
        return [
          ...(focusAfterChange?.(root, outcome.result.added) ?? []),
          toggleRef.current,
        ];
      },
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        // The name starts with the visible label, so speech input finds it, and then names
        // the subject, since the selected view shows one such toggle per card.
        aria-label={`${t('change.open')} ${entry.subjectId}`}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className={`${CONTROL} ${controlSize(touch)} self-start`}
      >
        <ArrowLeftRight size={touch ? 16 : 12} strokeWidth={2} aria-hidden />
        {t('change.open')}
        <ChevronDown
          size={touch ? 16 : 12}
          strokeWidth={2}
          aria-hidden
          className={open ? 'rotate-180' : ''}
        />
      </button>
      <div id={panelId} hidden={!open} className="flex flex-col gap-1">
        {open ? (
          <ChangeOptions
            entry={entry}
            locale={locale}
            t={t}
            touch={touch}
            onChange={handleChange}
          />
        ) : null}
      </div>
    </div>
  );
}
