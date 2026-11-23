// The readiness card of the registration helper, opened from the plan menu. It explains
// the prepare action, runs it on the student's press, and then says how ready the plan
// is: how many subjects the kit holds, which have other sections that fit, and which
// need a look before registration day. On a registration page the action is refused with
// a one line reason before anything is sent (ADR-0075).

import { useStore } from 'zustand';
import { ClipboardList, LoaderCircle } from 'lucide-react';
import { ModalDialog } from '@/components/ModalDialog';
import { Pill } from '@/components/Pill';
import { fillTemplate } from '@/lib/i18n/template';
import { pickLocalized } from '@/lib/i18n/localize';
import type { TranslationKey } from '@/lib/i18n/t';
import { summarizeKit, type AttentionReason } from '@/lib/regis/kit';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import { formatLocalDateTime } from '@/features/planner/examText';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { useQuietRoute } from '@/features/shell/quietRoute';
import { useTranslation } from '@/features/shell/useTranslation';
import { cancelPrepare, startPrepare } from './prepareController';
import { regisStore } from './regisStore';
import { useCompanionView } from './useCompanion';

const REASON_KEY: Record<AttentionReason, TranslationKey> = {
  missing: 'regis.reason.missing',
  unread: 'regis.reason.unread',
  full: 'regis.reason.full',
  closed: 'regis.reason.closed',
  conditions: 'regis.reason.conditions',
  duplicate: 'regis.reason.duplicate',
};

const BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-kcp px-3 py-1.5 text-sm font-semibold ${TARGET_HEIGHT}`;

export function ReadinessLayer() {
  const open = useStore(regisStore, (state) => state.readinessOpen);
  return open ? <ReadinessDialog /> : null;
}

function ReadinessDialog() {
  const { t, language } = useTranslation();
  const { send } = useSearchDeps();
  const quiet = useQuietRoute();
  const { plan, storedKit, kitState } = useCompanionView();
  const run = useStore(regisStore, (state) => state.run);
  const close = () => {
    regisStore.getState().setReadinessOpen(false);
  };
  const running = run.status === 'running' && run.planId === plan?.id;
  const empty = plan === null || plan.entries.length === 0;
  const summary = storedKit === null ? null : summarizeKit(storedKit);
  const names = new Map(
    plan?.entries.map((entry) => [
      entry.subjectId,
      pickLocalized(
        entry.snapshot.subjectMeta.nameTh,
        entry.snapshot.subjectMeta.nameEn,
        language,
      ),
    ]),
  );

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {quiet ? (
        <p className="mr-auto min-w-0 flex-1 text-xs text-warn">
          {t('regis.prepareRefused')}
        </p>
      ) : null}
      {running ? (
        <button
          type="button"
          onClick={cancelPrepare}
          className={`${BUTTON} border border-border text-ink hover:bg-surface-alt ${FOCUS_RING}`}
        >
          {t('action.cancel')}
        </button>
      ) : null}
      <button
        type="button"
        disabled={quiet || running || empty}
        onClick={() => {
          if (plan !== null) startPrepare(plan, send, t);
        }}
        className={`${BUTTON} bg-primary-strong text-white hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary-strong ${FOCUS_OUTLINE}`}
      >
        {t(storedKit === null ? 'regis.prepare' : 'regis.prepareAgain')}
      </button>
    </div>
  );

  return (
    <ModalDialog
      title={t('regis.title')}
      closeLabel={t('action.close')}
      onClose={close}
      width="medium"
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        <p>{t('regis.prepareIntro')}</p>
        {empty ? <p className="text-ink-soft">{t('regis.noPlan')}</p> : null}
        <div className="flex flex-col gap-1">
          {running ? (
            <p className="flex items-center gap-2">
              <LoaderCircle
                size={16}
                aria-hidden
                className="motion-safe:animate-spin"
              />
              {fillTemplate(t('regis.preparing'), {
                done: run.done,
                total: run.total,
              })}
            </p>
          ) : null}
          {run.status === 'cancelled' && run.planId === plan?.id ? (
            <p className="text-ink-soft">{t('regis.prepareCancelled')}</p>
          ) : null}
        </div>
        {storedKit !== null ? (
          <p className={kitState === 'stale' ? 'text-warn' : 'text-ink-soft'}>
            {kitState === 'stale'
              ? t('regis.kitStale')
              : fillTemplate(t('regis.preparedAt'), {
                  date: formatLocalDateTime(new Date(storedKit.preparedAt), t),
                })}
          </p>
        ) : null}
        {summary !== null ? (
          <section className="flex flex-col gap-2 rounded-kcp border border-border p-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <ClipboardList size={16} aria-hidden />
              {fillTemplate(t('regis.ready'), {
                ready: summary.ready,
                total: summary.total,
              })}
            </h3>
            <ul className="flex flex-col gap-2">
              {summary.subjects.map((subject) => (
                <li key={subject.subjectId} className="flex flex-col gap-1">
                  <span>
                    <span className="font-semibold">{subject.subjectId}</span>{' '}
                    {names.get(subject.subjectId) ?? ''}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {subject.reasons.map((reason) => (
                      <Pill
                        key={reason}
                        tone={
                          reason === 'missing' || reason === 'unread'
                            ? 'danger'
                            : 'warn'
                        }
                      >
                        {t(REASON_KEY[reason])}
                      </Pill>
                    ))}
                    {subject.reasons.includes('unread') ? null : (
                      <Pill
                        tone={
                          subject.fittingAlternatives > 0
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {subject.fittingAlternatives > 0
                          ? fillTemplate(t('regis.alternativesFit'), {
                              count: subject.fittingAlternatives,
                            })
                          : t('regis.noAlternativeFits')}
                      </Pill>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </ModalDialog>
  );
}
