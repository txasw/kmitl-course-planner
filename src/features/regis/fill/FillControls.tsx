// The student's fill controls in the registration helper (ADR-0078): the switch, Fill all
// in the header and Fill this subject on each row, Stop during a run, and Continue after
// a stop, with the reason and the next step in one sentence. These buttons are the only
// code that issues a student press, from their own click, so nothing but a deliberate
// press starts a run. Stop and Continue sit in different places, so one bounce cannot
// stop and resume a run, and a held key repeats nothing.

import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { Plan } from '@/lib/domain/plan';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import type { Checklist, ChecklistRow } from '@/lib/regis/checklist';
import { fillTarget, rowsToFill, type StopReason } from '@/lib/regis/fillPlan';
import { fillGate } from '@/lib/regis/hostBuild';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import { readScriptNames } from '../host/hostDom';
import { regisStore } from '../regisStore';
import {
  fillStore,
  requestStop,
  startFill,
  type FillRequest,
  type FillRun,
} from './fillRun';
import { issueStudentPress, type StudentPress } from './studentPress';

const BUTTON = `w-fit rounded-kcp px-2 text-xs font-semibold ${TARGET_HEIGHT} ${FOCUS_RING}`;

interface FillProps {
  plan: Plan;
  kit: RegistrationKit;
  t: Translate;
}

function itemsFor(
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

function PressButton({
  label,
  onPress,
}: {
  label: string;
  onPress: (press: StudentPress) => void;
}) {
  // A press counts only once the button has been on screen for a moment.
  const shownAt = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    shownAt.current = performance.now();
  }, []);
  return (
    <button
      type="button"
      data-fill-press
      onKeyDown={(event) => {
        if (event.repeat) event.preventDefault();
      }}
      onClick={(event) => {
        const press = issueStudentPress(event.nativeEvent, shownAt.current);
        if (press !== null) onPress(press);
      }}
      className={`${BUTTON} bg-primary-strong text-white hover:bg-primary-hover`}
    >
      {label}
    </button>
  );
}

/** Whether fill is available: switched on and allowed on this host build. */
function useFillGate(): StopReason | 'ok' | 'off' {
  const fill = useStore(regisStore, (state) => state.fill);
  if (fill.off) return 'off';
  return fillGate(readScriptNames(document), fill.latched);
}

function stepText(
  run: Extract<FillRun, { status: 'running' }>,
  t: Translate,
): string {
  return fillTemplate(t(`regis.fill.step.${run.step}`), {
    subjectId: run.subjectId,
    ids: run.prerequisites.join(' '),
  });
}

export function FillPanel({
  plan,
  kit,
  checklist,
  t,
}: FillProps & { checklist: Checklist }) {
  const off = useStore(regisStore, (state) => state.fill.off);
  const run = useStore(fillStore, (state) => state.run);
  const gate = useFillGate();
  const rows = checklist.rows.filter((row) => row.state === 'notDone');
  const start =
    (subjects: readonly string[], allowFull?: string[]) =>
    (press: StudentPress) => {
      void startFill(press, {
        plan,
        kit,
        items: itemsFor(rowsToFill(checklist.rows, subjects), plan, kit),
        ...(allowFull === undefined ? {} : { allowFull }),
      });
    };
  const rest =
    run.status === 'stopped'
      ? run.scope.slice(Math.max(0, run.scope.indexOf(run.subjectId ?? '')))
      : [];
  return (
    <section
      data-fill={run.status}
      className="flex flex-col gap-2 rounded-kcp border border-border p-2"
    >
      <label className="flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          checked={!off}
          onChange={(event) => {
            regisStore.getState().setFillOff(!event.currentTarget.checked);
          }}
        />
        {t('regis.fill.switch')}
      </label>
      {gate === 'off' ? null : gate !== 'ok' ? (
        <p className="text-warn">{t(`regis.fill.stop.${gate}`)}</p>
      ) : (
        <>
          {/* The one node that announces a run: its step, its stop, or its end. */}
          <p
            role="status"
            data-fill-stop={run.status === 'stopped' ? run.reason : undefined}
            className={
              run.status === 'done'
                ? 'text-success'
                : run.status === 'stopped'
                  ? 'text-warn'
                  : 'font-semibold'
            }
          >
            {run.status === 'running'
              ? `${fillTemplate(t('regis.fill.running'), {
                  done: run.done + 1,
                  total: run.total,
                })} ${stepText(run, t)}`
              : run.status === 'stopped'
                ? `${run.subjectId ?? ''} ${t(`regis.fill.stop.${run.reason}`)}`.trim()
                : run.status === 'done'
                  ? t('regis.fill.done')
                  : ''}
          </p>
          {run.status === 'running' ? (
            <>
              <p className="font-semibold text-warn">{t('regis.fill.warn')}</p>
              <button
                type="button"
                onClick={requestStop}
                className={`${BUTTON} border border-border text-ink hover:bg-surface-alt`}
              >
                {t('regis.fill.stop')}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {run.status === 'stopped' &&
              run.reason === 'full' &&
              run.subjectId !== null ? (
                <PressButton
                  label={t('regis.fill.continueFull')}
                  onPress={start(rest, [run.subjectId])}
                />
              ) : null}
              {run.status === 'stopped' && rest.length > 0 ? (
                <PressButton
                  label={t('regis.fill.continue')}
                  onPress={start(rest)}
                />
              ) : rows.length > 0 ? (
                <PressButton
                  label={t('regis.fill.all')}
                  onPress={start(rows.map((row) => row.subjectId))}
                />
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Fill this subject, on a row the page does not list yet, while no run is active. */
export function FillRowButton({
  row,
  plan,
  kit,
  t,
}: FillProps & { row: ChecklistRow }) {
  const running = useStore(
    fillStore,
    (state) => state.run.status === 'running',
  );
  const gate = useFillGate();
  if (gate !== 'ok' || running || row.state !== 'notDone') return null;
  return (
    <PressButton
      label={t('regis.fill.one')}
      onPress={(press) => {
        void startFill(press, { plan, kit, items: itemsFor([row], plan, kit) });
      }}
    />
  );
}
