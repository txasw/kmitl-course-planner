// The body of the registration helper dock and sheet: a header with the plan, its term,
// the credits and the progress, the fixed lines that KCP never submits and that pre
// registration goes in once, the kit status, one row per planned subject, the final
// review with differences first, and the way back to the full planner. It reads the plan,
// the kit, the student's marks, and on pre registration what the read only observer saw
// on the page, with a line saying whether that reading is on (ADR-0077).

import { CalendarDays, ShieldCheck } from 'lucide-react';
import type { Plan } from '@/lib/domain/plan';
import { fillTemplate } from '@/lib/i18n/template';
import { pickLocalized } from '@/lib/i18n/localize';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { finalReview, type Checklist } from '@/lib/regis/checklist';
import type { CompanionRoute } from '@/lib/regis/route';
import type { RegistrationKit } from '@/lib/regis/kitSchema';
import type { ObserverHealth } from '@/lib/regis/observerHealth';
import type { Term } from '@/lib/routing/academicTerms';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import { EmptyState } from '@/components/EmptyState';
import { formatLocalDateTime } from '@/features/planner/examText';
import { termLabel } from '@/features/plans/PlanList';
import { uiStore } from '@/features/shell/uiStore';
import { ChecklistRow, STATE_KEY, StateIcon } from './ChecklistRow';
import { saveBackupToPlan } from './saveBackup';
import type { KitState } from './useCompanion';

interface DockContentProps {
  route: CompanionRoute;
  plan: Plan | null;
  checklist: Checklist | null;
  kit: RegistrationKit | null;
  storedKit: RegistrationKit | null;
  kitState: KitState;
  health: ObserverHealth;
  pageTerm: Term | null;
  locale: Locale;
  t: Translate;
}

/** The observer line on pre registration, or null while it waits for the page. */
function observerKey(health: ObserverHealth): TranslationKey | null {
  if (health.status === 'healthy') return 'regis.observer.on';
  if (health.status === 'waiting') return null;
  if (health.status === 'off' && health.reason === 'untestedBuild') {
    return 'regis.observer.untested';
  }
  if (health.status === 'off' && health.reason === 'surrogate') {
    return 'regis.observer.surrogate';
  }
  return 'regis.observer.degraded';
}

function openPlanner() {
  uiStore.getState().open();
}

function OpenPlannerButton({ t }: { t: Translate }) {
  return (
    <button
      type="button"
      onClick={openPlanner}
      className={`inline-flex items-center gap-1.5 rounded-kcp border border-border px-2 text-xs font-semibold text-ink hover:bg-surface-alt ${TARGET_HEIGHT} ${FOCUS_RING}`}
    >
      <CalendarDays size={14} aria-hidden />
      {t('regis.openPlanner')}
    </button>
  );
}

function FinalReview({
  route,
  checklist,
  locale,
  t,
}: {
  route: CompanionRoute;
  checklist: Checklist;
  locale: Locale;
  t: Translate;
}) {
  const review = finalReview(checklist);
  const mismatches = review.filter((item) => item.kind === 'mismatch').length;
  return (
    <section className="flex flex-col gap-2 rounded-kcp border border-border p-3 text-xs">
      <h3 className="text-sm font-semibold">{t('regis.review')}</h3>
      <p
        className={mismatches > 0 ? 'font-semibold text-warn' : 'text-success'}
      >
        {mismatches > 0
          ? fillTemplate(
              t(
                // Only pre registration is a one time submit, so only it says so.
                route === 'preRegistration'
                  ? 'regis.reviewMismatch'
                  : 'regis.reviewMismatchRegistration',
              ),
              { count: mismatches },
            )
          : fillTemplate(t('regis.reviewAllMatch'), { count: checklist.total })}
      </p>
      <ul className="flex flex-col gap-1">
        {review.map(({ row, kind }) => (
          <li key={row.subjectId} className="flex items-start gap-1.5">
            <StateIcon state={row.state} />
            <span className="min-w-0">
              <span className="font-semibold tabular-nums">
                {row.subjectId}
              </span>{' '}
              {pickLocalized(row.nameTh, row.nameEn, locale)}{' '}
              <span className="text-ink-soft">{t(STATE_KEY[row.state])}</span>
              {kind === 'checkCurriculum' ? (
                <span className="block text-warn">
                  {t('regis.reviewCurriculum')}
                </span>
              ) : null}
              {kind === 'conditional' ? (
                <span className="block text-warn">
                  {t('regis.conditionalNote')}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p>{t('regis.handOff')}</p>
    </section>
  );
}

export function DockContent({
  route,
  plan,
  checklist,
  kit,
  storedKit,
  kitState,
  health,
  pageTerm,
  locale,
  t,
}: DockContentProps) {
  const observer = route === 'preRegistration' ? observerKey(health) : null;
  if (plan === null || checklist === null || checklist.total === 0) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <EmptyState
          icon={CalendarDays}
          title={t('regis.noPlan')}
          description={t('regis.noPlanBody')}
          action={<OpenPlannerButton t={t} />}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-3 text-xs">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{plan.name}</p>
        <p className="text-ink-soft">
          {termLabel(plan, t)}{' '}
          {fillTemplate(t('regis.credits'), { credits: checklist.credits })}
        </p>
        <p className="font-semibold">
          {fillTemplate(t('regis.progress'), {
            done: checklist.done,
            total: checklist.total,
          })}
        </p>
        <p
          className={
            checklist.termMismatch
              ? 'font-semibold text-danger'
              : 'text-ink-soft'
          }
        >
          {pageTerm === null
            ? fillTemplate(t('regis.termCheck'), { term: termLabel(plan, t) })
            : checklist.termMismatch
              ? fillTemplate(t('regis.pageTermMismatch'), {
                  plan: termLabel(plan, t),
                  page: termLabel(pageTerm, t),
                })
              : fillTemplate(t('regis.pageTermMatch'), {
                  term: termLabel(pageTerm, t),
                })}
        </p>
        {observer === null ? null : (
          <p
            data-observer={health.status}
            className={
              health.status === 'healthy' ? 'text-ink-soft' : 'text-warn'
            }
          >
            {t(observer)}
          </p>
        )}
        {checklist.extras.length > 0 ? (
          <p className="text-warn">
            {fillTemplate(t('regis.extras'), {
              items: checklist.extras
                .map((item) => `${item.subjectId} (${item.codes.join(' ')})`)
                .join(', '),
            })}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 rounded-kcp bg-surface-alt p-2">
        <p className="flex items-start gap-1.5 font-semibold">
          <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span>{t('regis.neverSubmits')}</span>
        </p>
        <p>
          {t(
            route === 'preRegistration'
              ? 'regis.onceOnly'
              : 'regis.registrationNote',
          )}
        </p>
      </div>
      <p className={kitState === 'fresh' ? 'text-ink-soft' : 'text-warn'}>
        {kitState === 'fresh' && storedKit !== null
          ? fillTemplate(t('regis.preparedAt'), {
              date: formatLocalDateTime(new Date(storedKit.preparedAt), t),
            })
          : t(kitState === 'stale' ? 'regis.kitStale' : 'regis.noKit')}
      </p>
      <ol className="flex flex-col gap-2">
        {checklist.rows.map((row) => (
          <ChecklistRow
            key={row.subjectId}
            route={route}
            row={row}
            plan={plan}
            locale={locale}
            t={t}
            onSave={
              kit === null || row.chosen === null
                ? null
                : () => {
                    saveBackupToPlan(plan, kit, row, t);
                  }
            }
          />
        ))}
      </ol>
      <FinalReview route={route} checklist={checklist} locale={locale} t={t} />
      <div className="flex flex-col gap-2 border-t border-border pt-2">
        <OpenPlannerButton t={t} />
        <p className="text-ink-soft">{t('regis.noRequests')}</p>
      </div>
    </div>
  );
}
