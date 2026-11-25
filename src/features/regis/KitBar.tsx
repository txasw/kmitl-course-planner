// The helper card's bar for a plan with nothing prepared (ADR-0076). It says so once, on
// one line, and on the pre registration page it offers to prepare right there, since a
// student who reaches the page without preparing has nowhere else to go: Prepare data
// starts the same kit pipeline the planner's prepare card runs, one subject at a time
// with a pause and no retry, through the background gateway. While it reads, the line
// shows its progress and Cancel; a failed read says so and offers the press again, which
// is the student's own, never a retry KCP makes. On the registration page, the first come
// page, the bar only says that nothing is prepared.

import { useStore } from 'zustand';
import { ClipboardList, LoaderCircle } from 'lucide-react';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { useOptionalSearchDeps } from '@/features/search/SearchDepsContext';
import { cancelPrepare, startHelperPrepare } from './prepareController';
import { regisStore } from './regisStore';
import type { HelperModel } from './useHelperModel';

/** The id of the bar's words, which a blocked Add for me points at. */
export const KIT_TEXT_ID = 'kcp-regis-kit';

const BAR =
  'mx-1 mb-2 flex min-h-8 items-center gap-2 rounded-kcp-sm py-1 pr-1 pl-2 text-xs font-semibold max-sm:min-h-11 bg-surface-alt text-ink-soft';

const BAR_BUTTON =
  'inline-flex min-h-8 shrink-0 items-center rounded-kcp px-3 text-xs font-semibold max-sm:min-h-10';

export function KitBar({ model, t }: { model: HelperModel; t: Translate }) {
  const deps = useOptionalSearchDeps();
  const run = useStore(regisStore, (state) => state.run);
  const { plan } = model;
  const ours = run.status !== 'idle' && run.planId === plan?.id;
  const running = ours && run.status === 'running' ? run : null;
  const failed = ours && run.status === 'failed';
  const offered =
    model.route === 'preRegistration' && deps !== null && plan !== null;

  if (running !== null) {
    return (
      <div className={BAR} data-kit-bar="preparing">
        <LoaderCircle
          size={16}
          aria-hidden
          className="shrink-0 motion-safe:animate-spin"
        />
        <span id={KIT_TEXT_ID} className="min-w-0 flex-1 text-left">
          {fillTemplate(t('regis.preparing'), {
            done: running.done,
            total: running.total,
          })}
        </span>
        <button
          type="button"
          onClick={cancelPrepare}
          className={`${BAR_BUTTON} border border-border bg-surface text-ink hover:bg-surface-alt ${FOCUS_RING}`}
        >
          {t('action.cancel')}
        </button>
      </div>
    );
  }
  return (
    <div className={BAR} data-kit-bar={failed ? 'failed' : 'none'}>
      <ClipboardList size={16} aria-hidden className="shrink-0" />
      <span id={KIT_TEXT_ID} className="min-w-0 flex-1 text-left">
        {t(failed ? 'regis.prepareFailedShort' : 'regis.noKitShort')}
      </span>
      {offered ? (
        <button
          type="button"
          onClick={(event) => {
            startHelperPrepare(event.nativeEvent, plan, deps.send, t);
          }}
          className={`${BAR_BUTTON} bg-primary-strong text-white hover:bg-primary-hover ${FOCUS_OUTLINE}`}
        >
          {t('regis.prepareInline')}
        </button>
      ) : null}
    </div>
  );
}
