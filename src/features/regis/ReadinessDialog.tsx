// The prepare card of the registration helper, opened from the plan menu. It explains the
// prepare action, runs it on the student's press, and says when the kit was prepared. The
// helper card's count and list on the registration page read each subject from there, so
// this card keeps no review of its own. On a registration page the action is refused with
// a one line reason before anything is sent (ADR-0075).

import { useStore } from 'zustand';
import { LoaderCircle } from 'lucide-react';
import { ModalDialog } from '@/components/ModalDialog';
import { fillTemplate } from '@/lib/i18n/template';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import { formatLocalDateTime } from '@/features/planner/examText';
import { useSearchDeps } from '@/features/search/SearchDepsContext';
import { useQuietRoute } from '@/features/shell/quietRoute';
import { useTranslation } from '@/features/shell/useTranslation';
import { cancelPrepare, startPrepare } from './prepareController';
import { regisStore } from './regisStore';
import { useCompanionView } from './useCompanion';

const BUTTON = `inline-flex items-center justify-center gap-1.5 rounded-kcp px-3 py-1.5 text-sm font-semibold ${TARGET_HEIGHT}`;

export function ReadinessLayer() {
  const open = useStore(regisStore, (state) => state.readinessOpen);
  return open ? <ReadinessDialog /> : null;
}

function ReadinessDialog() {
  const { t } = useTranslation();
  const { send } = useSearchDeps();
  const quiet = useQuietRoute();
  // The prepare card prepares the plan the planner shows, whatever page it opens over.
  const { plan, storedKit, kitState } = useCompanionView('active');
  const run = useStore(regisStore, (state) => state.run);
  const close = () => {
    regisStore.getState().setReadinessOpen(false);
  };
  const running = run.status === 'running' && run.planId === plan?.id;
  const empty = plan === null || plan.entries.length === 0;

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
      </div>
    </ModalDialog>
  );
}
