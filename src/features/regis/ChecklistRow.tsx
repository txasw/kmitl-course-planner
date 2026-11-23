// One planned subject in the registration checklist: the subject id with a copy button,
// the name and credits, the planned group with every meeting and exam window, the notes
// that need the student's eyes, the other groups with their fit at prepare time, and the
// mark the student sets by hand. While the read only observer is healthy the row also says
// what the page shows (ADR-0077); a mark the student sets overrides it and both stay in
// view. A backup chosen here stays a mark until saved.

import { useId, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleSlash,
  Copy,
  GitBranch,
  Info,
} from 'lucide-react';
import { Disclosure } from '@/components/Disclosure';
import { Pill, type PillTone } from '@/components/Pill';
import type { Plan } from '@/lib/domain/plan';
import { fillTemplate } from '@/lib/i18n/template';
import { pickLocalized } from '@/lib/i18n/localize';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import {
  MARK_STATES,
  type ChecklistRow as Row,
  type MarkState,
  type RowAlternative,
  type RowState,
} from '@/lib/regis/checklist';
import type { ObservedState } from '@/lib/regis/observedRow';
import type { KitFit } from '@/lib/regis/kitSchema';
import type { CompanionRoute } from '@/lib/regis/route';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT, TARGET_SIZE } from '@/lib/ui/target';
import { copySubjectId } from '@/features/planner/copySubjectId';
import { regisStore } from './regisStore';
import { SectionLines } from './SectionLines';

export const STATE_KEY: Record<RowState, TranslationKey> = {
  notDone: 'regis.state.notDone',
  added: 'regis.state.added',
  addedOther: 'regis.state.addedOther',
  conditional: 'regis.state.conditional',
  skipped: 'regis.state.skipped',
  termMismatch: 'regis.state.termMismatch',
  refused: 'regis.state.refused',
  submitted: 'regis.state.submitted',
  granted: 'regis.state.granted',
  notGranted: 'regis.state.notGranted',
  notSubmitted: 'regis.state.notSubmitted',
};

const OBSERVED_KEY: Record<ObservedState, TranslationKey> = {
  notListed: 'regis.observed.notListed',
  listed: 'regis.observed.listed',
  listedOther: 'regis.observed.listedOther',
  refused: 'regis.observed.refused',
  waiting: 'regis.state.submitted',
  granted: 'regis.state.granted',
  notGranted: 'regis.state.notGranted',
  notGrantedCondition: 'regis.observed.notGrantedCondition',
  notSubmitted: 'regis.state.notSubmitted',
};

const FIT_KEY: Record<KitFit, TranslationKey> = {
  fits: 'regis.fit.fits',
  time: 'regis.fit.time',
  exam: 'regis.fit.exam',
};

/** The icon that carries a row state beside its text, never colour alone. */
export function StateIcon({ state }: { state: RowState }) {
  const props = { size: 18, 'aria-hidden': true, className: 'shrink-0' };
  switch (state) {
    case 'added':
    case 'granted':
      return <CheckCircle2 {...props} className="shrink-0 text-success" />;
    case 'addedOther':
      return <GitBranch {...props} className="shrink-0 text-warn" />;
    case 'conditional':
      return <AlertTriangle {...props} className="shrink-0 text-warn" />;
    case 'submitted':
      return <CheckCircle2 {...props} className="shrink-0 text-ink-soft" />;
    case 'refused':
    case 'notGranted':
      return <CircleSlash {...props} className="shrink-0 text-danger" />;
    case 'notSubmitted':
      return <AlertTriangle {...props} className="shrink-0 text-danger" />;
    case 'skipped':
      return <CircleSlash {...props} className="shrink-0 text-ink-soft" />;
    case 'termMismatch':
      return <AlertTriangle {...props} className="shrink-0 text-danger" />;
    case 'notDone':
      return <Circle {...props} className="shrink-0 text-ink-soft" />;
  }
}

function Note({ tone, text }: { tone: 'warn' | 'info'; text: string }) {
  return (
    <p
      className={`flex items-start gap-1.5 ${tone === 'warn' ? 'text-warn' : 'text-ink-soft'}`}
    >
      {tone === 'warn' ? (
        <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
      ) : (
        <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
      )}
      <span className="min-w-0">{text}</span>
    </p>
  );
}

interface AlternativeProps {
  option: RowAlternative;
  chosen: boolean;
  disabled: boolean;
  onChoose: () => void;
  t: Translate;
}

function Alternative({
  option,
  chosen,
  disabled,
  onChoose,
  t,
}: AlternativeProps) {
  const fitTone: PillTone = option.fit === 'fits' ? 'success' : 'danger';
  return (
    <li className="flex flex-col gap-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
      <SectionLines sections={option.sections} t={t} />
      <span className="flex flex-wrap gap-1">
        <Pill tone={fitTone}>{t(FIT_KEY[option.fit])}</Pill>
        {option.seat === 'full' ? (
          <Pill tone="warn">{t('seat.full')}</Pill>
        ) : null}
        {option.seat === 'closed' ? (
          <Pill tone="danger">{t('regis.seat.closed')}</Pill>
        ) : null}
        {option.ownCurriculum === true ? (
          <Pill tone="neutral">{t('regis.ownCurriculum')}</Pill>
        ) : null}
      </span>
      {chosen ? null : (
        <button
          type="button"
          disabled={disabled}
          onClick={onChoose}
          className={`w-fit rounded-kcp border border-border px-2 text-xs font-semibold text-ink hover:bg-surface-alt disabled:opacity-50 ${TARGET_HEIGHT} ${FOCUS_RING}`}
        >
          {t('regis.useInstead')}
        </button>
      )}
    </li>
  );
}

interface ChecklistRowProps {
  route: CompanionRoute;
  row: Row;
  plan: Plan;
  locale: Locale;
  t: Translate;
  /** Saves the chosen backup to the plan; null when no kit backs the row. */
  onSave: (() => void) | null;
  /** The row's fill control on pre registration, or null. */
  fill?: ReactNode;
}

export function ChecklistRow({
  route,
  row,
  plan,
  locale,
  t,
  onSave,
  fill = null,
}: ChecklistRowProps) {
  const selectId = useId();
  const primary = pickLocalized(row.nameTh, row.nameEn, locale);
  const secondary = pickLocalized(row.nameEn, row.nameTh, locale);
  const conditions = locale === 'th' ? row.conditionsTh : row.conditionsEn;
  const mismatch = row.state === 'termMismatch';
  const setMark = (state: MarkState | 'notDone', chosenIds?: string[]) => {
    regisStore.getState().setMark(
      plan,
      row.subjectId,
      state === 'notDone'
        ? null
        : {
            state,
            at: new Date().toISOString(),
            ...(chosenIds === undefined ? {} : { chosenIds }),
          },
    );
  };

  return (
    <li className="flex flex-col gap-2 rounded-kcp border border-border bg-surface p-3 text-xs">
      <div className="flex items-start gap-2">
        <StateIcon state={row.state} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex items-center gap-1">
            <span className="text-sm font-semibold tabular-nums">
              {row.subjectId}
            </span>
            <button
              type="button"
              aria-label={fillTemplate(t('regis.copyId'), {
                subjectId: row.subjectId,
              })}
              onClick={() => {
                copySubjectId(row.subjectId, t);
              }}
              className={`flex items-center justify-center rounded-kcp text-ink-soft hover:bg-surface-alt hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`}
            >
              <Copy size={14} aria-hidden />
            </button>
          </p>
          <p className="text-sm">{primary}</p>
          {secondary !== primary && secondary !== '' ? (
            <p className="text-ink-soft">{secondary}</p>
          ) : null}
          <p className="text-ink-soft">
            {fillTemplate(t('regis.credits'), { credits: row.credit })}
          </p>
        </div>
      </div>
      <SectionLines sections={row.planned} t={t} />
      {fill}
      {row.missing ? (
        <Note
          tone="warn"
          text={t(
            row.alternatives.length > 0
              ? 'regis.missingNote'
              : 'regis.unreadNote',
          )}
        />
      ) : null}
      {row.plannedSeat === 'full' ? (
        <Note
          tone="info"
          text={t(
            // Pre registration assigns seats later; on regular registration a full
            // section stays full, so that page's seat count is the one to trust.
            route === 'preRegistration'
              ? 'regis.fullNote'
              : 'regis.fullNoteRegistration',
          )}
        />
      ) : null}
      {row.plannedSeat === 'closed' ? (
        <Note tone="warn" text={t('regis.closedNote')} />
      ) : null}
      {row.duplicateCode !== null ? (
        <Note
          tone="warn"
          text={fillTemplate(t('regis.duplicateNote'), {
            code: row.duplicateCode,
          })}
        />
      ) : null}
      {conditions.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold">{t('regis.conditions')}</p>
          {conditions.map((rule) => (
            <p key={rule} className="text-ink-soft">
              {rule}
            </p>
          ))}
        </div>
      ) : null}
      {row.state === 'conditional' ? (
        <Note tone="warn" text={t('regis.conditionalNote')} />
      ) : null}
      {row.observed === null ? null : (
        <div
          className="flex flex-col gap-0.5"
          data-observed={row.observed.state}
        >
          <p className="font-semibold">
            {fillTemplate(t('regis.observed'), {
              state: fillTemplate(t(OBSERVED_KEY[row.observed.state]), {
                codes: row.observed.codes.join(' '),
              }),
            })}
          </p>
          {row.observed.prerequisites.length > 0 ? (
            <p className="text-warn">
              {fillTemplate(t('regis.observed.prerequisites'), {
                ids: row.observed.prerequisites.join(' '),
              })}
            </p>
          ) : null}
          {row.mark === null ? null : (
            <p className="text-ink-soft">{t('regis.markOverride')}</p>
          )}
        </div>
      )}
      {row.chosen !== null ? (
        <div className="flex flex-col gap-1 rounded-kcp bg-surface-alt p-2">
          <p className="font-semibold">
            {fillTemplate(t('regis.chosen'), {
              codes: row.chosen.sections.map((item) => item.section).join(' '),
            })}
          </p>
          <SectionLines sections={row.chosen.sections} t={t} />
          {onSave !== null ? (
            <button
              type="button"
              onClick={onSave}
              className={`w-fit rounded-kcp bg-primary-strong px-2 text-xs font-semibold text-white hover:bg-primary-hover ${TARGET_HEIGHT} ${FOCUS_RING}`}
            >
              {t('regis.saveToPlan')}
            </button>
          ) : null}
        </div>
      ) : null}
      {row.alternatives.length > 0 ? (
        <Disclosure
          label={fillTemplate(t('regis.alternatives'), {
            count: row.alternatives.length,
          })}
        >
          <ul className="flex flex-col gap-2 py-1">
            {row.alternatives.map((option) => (
              <Alternative
                key={option.ids.join(' ')}
                option={option}
                chosen={row.chosen?.ids.join(' ') === option.ids.join(' ')}
                disabled={mismatch}
                onChoose={() => {
                  setMark('addedOther', option.ids);
                }}
                t={t}
              />
            ))}
          </ul>
        </Disclosure>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-ink-soft">
          {t('regis.status')}
        </label>
        <select
          id={selectId}
          value={mismatch ? 'termMismatch' : (row.mark ?? 'notDone')}
          disabled={mismatch}
          onChange={(event) => {
            const next = MARKS.find((state) => state === event.target.value);
            if (next === undefined) return;
            setMark(next, next === 'addedOther' ? row.chosen?.ids : undefined);
          }}
          className={`rounded-kcp border border-border bg-surface px-2 text-xs text-ink ${TARGET_HEIGHT} ${FOCUS_RING}`}
        >
          {mismatch ? (
            <option value="termMismatch">{t(STATE_KEY.termMismatch)}</option>
          ) : null}
          {MARKS.map((state) => (
            <option key={state} value={state}>
              {t(
                state === 'notDone' && row.observed !== null
                  ? 'regis.mark.follow'
                  : STATE_KEY[state],
              )}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

const MARKS: readonly (MarkState | 'notDone')[] = ['notDone', ...MARK_STATES];
