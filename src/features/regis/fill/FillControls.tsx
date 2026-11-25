// The student's fill controls in the registration helper (ADR-0078): Add for me on the
// subject in focus and on each list row, Add all for me in the more menu, and the step
// progress with Stop during a run. These buttons are the only code that issues a student
// press, from their own click, so nothing but a deliberate press starts a run. A press
// counts only once its button has been on screen for a moment, so a button that turns
// from disabled to enabled is a new button whose moment starts then. Stop takes the place
// of Add for me while a run is active, so one bounce cannot stop and resume a run, and a
// held key repeats nothing.

import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { useStore } from 'zustand';
import { Plus, X } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import type { Plan } from '@/lib/domain/plan';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import type { ChecklistRow } from '@/lib/regis/checklist';
import {
  fillPressKey,
  fillTarget,
  type StopReason,
} from '@/lib/regis/fillPlan';
import { fillGate } from '@/lib/regis/hostBuild';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { readScriptNames } from '../host/hostDom';
import { regisStore } from '../regisStore';
import type { FillStep } from './fillEngine';
import {
  fillStore,
  requestStop,
  startFill,
  type FillRequest,
  type FillRun,
} from './fillRun';
import { issueStudentPress, type StudentPress } from './studentPress';

/** The shared box of the action row's buttons, 36 px high and 44 px on a phone. */
export const ACTION_BUTTON =
  'inline-flex min-h-9 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-kcp px-2 text-sm max-sm:min-h-11 pointer-coarse:min-h-11';

const PRIMARY = `${ACTION_BUTTON} bg-primary-strong font-semibold text-white hover:bg-primary-hover ${FOCUS_OUTLINE}`;

interface FillProps {
  plan: Plan;
  kit: RegistrationKit;
}

export function itemsFor(
  rows: readonly ChecklistRow[],
  plan: Plan,
  kit: RegistrationKit,
): FillRequest['items'] {
  return rows.map((row) => {
    const target = fillTarget(row, plan, kit);
    return typeof target === 'string'
      ? { subjectId: row.subjectId, reason: target }
      : target;
  });
}

interface PressButtonProps {
  label: string;
  onPress: (press: StudentPress) => void;
  className: string;
  children: ReactNode;
  /** Props of a wrapper such as a tooltip or a menu, spread first so the press handlers win. */
  extra?: Record<string, unknown>;
  buttonRef?: Ref<HTMLButtonElement>;
}

function PressButton({
  label,
  onPress,
  className,
  children,
  extra,
  buttonRef,
}: PressButtonProps) {
  // A press counts only once the button has been on screen for a moment.
  const shownAt = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  return (
    <button
      ref={buttonRef}
      {...extra}
      type="button"
      aria-label={label}
      data-fill-press
      onKeyDown={(event) => {
        if (event.repeat) event.preventDefault();
      }}
      onClick={(event) => {
        const press = issueStudentPress(event.nativeEvent, shownAt.current);
        if (press !== null) onPress(press);
      }}
      className={className}
    >
      {children}
    </button>
  );
}

/**
 * Records, while it is mounted with a subject, that the card shows that subject's
 * condition, so the run acknowledges the grade dialog only while KCP shows it (5B).
 */
export function useShowCondition(subjectId: string | null): void {
  useEffect(() => {
    if (subjectId === null) return undefined;
    fillStore.setState({ shown: { subjectId, at: Date.now() } });
    return () => {
      fillStore.setState({ shown: null });
    };
  }, [subjectId]);
}

/** Whether fill can act here: switched on and allowed on this host build. */
export function useFillGate(): StopReason | 'ok' | 'off' {
  const fill = useStore(regisStore, (state) => state.fill);
  if (fill.off) return 'off';
  return fillGate(readScriptNames(document), fill.latched);
}

interface AddForMeProps extends FillProps {
  row: ChecklistRow;
  /** Fill the planned section even though the page shows it over subscribed. */
  allowFull: boolean;
  /** Show the plus icon alone, for a list row, with the label as its name. */
  compact?: boolean;
  t: Translate;
}

/**
 * Add for me on one subject still to add: a press starts a run for that subject. On a list
 * row it is a quiet outlined icon, so the card's own Add for me stays the one filled orange
 * control in the helper.
 */
export function AddForMeButton({
  row,
  plan,
  kit,
  allowFull,
  compact = false,
  t,
}: AddForMeProps) {
  const label = t('regis.addForMe');
  const items = itemsFor([row], plan, kit);
  const full = allowFull ? [row.subjectId] : [];
  const onPress = (press: StudentPress) => {
    void startFill(press, {
      plan,
      kit,
      items,
      ...(allowFull ? { allowFull: full } : {}),
    });
  };
  // The focus card keeps this button in place while its subject, its sections, or the
  // helper's plan change, so a new target is a new button whose moment starts then, as a
  // button that turns enabled is.
  const key = fillPressKey(plan.id, items, full);
  if (!compact) {
    return (
      <PressButton
        key={key}
        label={label}
        onPress={onPress}
        className={PRIMARY}
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        <span>{label}</span>
      </PressButton>
    );
  }
  // The icon alone on a list row says what it does in a tooltip on hover and focus.
  return (
    <Tooltip label={label}>
      {(triggerProps, ref) => (
        <PressButton
          key={key}
          label={`${label} ${row.subjectId}`}
          onPress={onPress}
          extra={triggerProps}
          buttonRef={ref}
          className={`inline-flex size-11 shrink-0 items-center justify-center rounded-kcp bg-surface text-primary-strong ring-1 ring-border ring-inset hover:bg-surface-alt sm:size-9 ${FOCUS_RING}`}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        </PressButton>
      )}
    </Tooltip>
  );
}

interface AddAllProps extends FillProps {
  /** Every subject still to add, in plan order; the press names exactly these. */
  rows: readonly ChecklistRow[];
  label: string;
  /** Called on a counted press before the run starts, to put the card in view. */
  onStart: () => void;
  className: string;
  children: ReactNode;
}

/**
 * Add all for me, a more menu item: one press starts one run that names every subject
 * still to add. The run still goes one subject at a time, waits for the page between
 * steps, and ends at the first stop (owner answer 3A). The item is keyed by the plan and
 * the sections it fills, so a change of either is a new item whose moment starts then.
 */
export function AddAllMenuItem({
  rows,
  plan,
  kit,
  label,
  onStart,
  className,
  children,
}: AddAllProps) {
  const items = itemsFor(rows, plan, kit);
  return (
    <PressButton
      key={fillPressKey(plan.id, items)}
      label={label}
      extra={{ role: 'menuitem', tabIndex: -1 }}
      onPress={(press) => {
        onStart();
        void startFill(press, { plan, kit, items });
      }}
      className={className}
    >
      {children}
    </PressButton>
  );
}

/** The three steps the progress shows, from the engine's finer steps. */
const STEP_OF: Readonly<Record<FillStep, 1 | 2 | 3>> = {
  enter: 1,
  wait: 1,
  conditional: 1,
  choose: 2,
  practice: 2,
  add: 3,
};

export function stepNumber(step: FillStep): 1 | 2 | 3 {
  return STEP_OF[step];
}

/** The word of each of the three steps. */
export const STEP_WORD = {
  1: 'regis.step.1',
  2: 'regis.step.2',
  3: 'regis.step.3',
} as const;

const SEGMENT =
  'h-1 rounded-full transition-colors motion-reduce:transition-none';

/** The action row of a subject being added: its step, the step bar, and Stop. */
export function RunProgress({
  run,
  t,
}: {
  run: Extract<FillRun, { status: 'running' }>;
  t: Translate;
}) {
  const step = STEP_OF[run.step];
  const stepOf = fillTemplate(t('regis.stepOf'), { n: step });
  return (
    <>
      <div
        role="group"
        aria-label={stepOf}
        className="flex min-w-0 flex-1 basis-0 flex-col justify-center gap-1.5"
      >
        <p className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold text-ink-soft tabular-nums">
            {step}/3
          </span>
          <span className="text-sm font-semibold text-ink">
            {t(STEP_WORD[step])}
          </span>
        </p>
        <span aria-hidden className="grid grid-cols-3 gap-1">
          {([1, 2, 3] as const).map((index) => (
            <span
              key={index}
              className={`${SEGMENT} ${
                index < step
                  ? 'bg-ink-soft'
                  : index === step
                    ? 'bg-primary'
                    : 'bg-border'
              }`}
            />
          ))}
        </span>
      </div>
      <button
        type="button"
        id="kcp-regis-stop"
        onClick={requestStop}
        className={`${ACTION_BUTTON} border border-border bg-surface text-ink hover:bg-surface-alt ${FOCUS_RING}`}
      >
        <X size={16} aria-hidden />
        {t('regis.stop')}
      </button>
    </>
  );
}
