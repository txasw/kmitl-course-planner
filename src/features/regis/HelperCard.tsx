// The registration helper card (ADR-0076, design C2): a compact white card that rises
// above the launcher at the bottom right, a labelled region that is never modal, so the
// page stays usable while it is open. Its header holds the count, which opens the list of
// every subject, and the more menu; under it sits at most one bar, for a page KCP cannot
// read, a page of another term, or a plan with nothing prepared; then the queue of
// subjects and the subject in focus. Escape inside it collapses it to the launcher. On a
// phone a press anywhere on the page collapses it too, so the keyboard or a host dialog is
// never hidden behind it (kept from commit 036227e).

import { useEffect, useRef, type RefObject } from 'react';
import { useStore } from 'zustand';
import {
  CalendarClock,
  CalendarDays,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { Locale, Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import {
  BREAKPOINTS,
  COARSE_POINTER_QUERY,
  minWidthQuery,
} from '@/lib/ui/breakpoints';
import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { rootOf } from '@/features/shell/useFocusTrap';
import { uiStore } from '@/features/shell/uiStore';
import { useMediaQuery } from '@/features/shell/useMediaQuery';
import { useTranslation } from '@/features/shell/useTranslation';
import { FocusSection, STALE_TEXT_ID } from './FocusSection';
import {
  CARD_ID,
  COUNT_ID,
  helperStore,
  setCollapsed,
  setCurrent,
  setView,
} from './helperStore';
import { HelperMoreMenu } from './HelperMoreMenu';
import { hostStore } from './host/hostStore';
import { QueueChips } from './QueueChips';
import { LIST_ID, QueueList } from './QueueList';
import type { HelperModel } from './useHelperModel';
import { useOutsidePress } from './useOutsidePress';

function collapse() {
  setCollapsed(true);
}

/** Collapse to the launcher, which then takes focus, so focus never falls to the page. */
function collapseFrom(node: HTMLElement) {
  const root = rootOf(node);
  commitThenFocus(
    () => {
      setCollapsed(true);
    },
    () => [root?.getElementById(LAUNCHER_ID)],
  );
}

// Escape inside the card leaves the list for the card, or collapses the card to the
// launcher. It listens on the card's root after React's own handlers, so a section menu or
// the more menu that takes the key first keeps the card as it is; the host page keeps its
// own Escape everywhere else.
function useEscapeInside(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = ref.current;
    const root = node === null ? null : rootOf(node);
    if (node === null || root === null) return undefined;
    const handleKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (!event.composedPath().includes(node)) return;
      if (helperStore.getState().view === 'list') {
        commitThenFocus(
          () => {
            setView('card');
          },
          () => [root.getElementById(COUNT_ID)],
        );
        return;
      }
      collapseFrom(node);
    };
    root.addEventListener('keydown', handleKeyDown);
    return () => {
      root.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref]);
}

// One bar at a time under the header: a page KCP cannot read, a page of another term, or
// a plan with nothing prepared. Only the first offers an action, Check again.
function Bar({ model, t }: { model: HelperModel; t: Translate }) {
  const [Icon, key, tone] = model.stale
    ? ([EyeOff, 'regis.unreadable', 'bg-warn-soft text-warn'] as const)
    : model.termMismatch
      ? ([
          CalendarClock,
          'regis.state.termMismatch',
          'bg-warn-soft pr-2 text-warn',
        ] as const)
      : !model.hasKit
        ? ([
            ClipboardList,
            'regis.noKitShort',
            'bg-surface-alt pr-2 text-ink-soft',
          ] as const)
        : [null, null, null];
  if (Icon === null) return null;
  return (
    <div
      className={`mx-1 mb-2 flex min-h-8 items-center gap-2 rounded-kcp-sm pl-2 text-xs font-semibold max-sm:min-h-11 ${tone}`}
    >
      <Icon size={16} aria-hidden className="shrink-0" />
      <span id={model.stale ? STALE_TEXT_ID : undefined} className="flex-1">
        {t(key)}
      </span>
      {model.stale ? (
        <button
          type="button"
          aria-label={t('regis.recheck')}
          onClick={() => {
            hostStore.getState().recheck();
          }}
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-kcp hover:bg-surface-alt max-sm:size-11 ${FOCUS_RING}`}
        >
          <RefreshCw size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

interface CardViewProps {
  model: HelperModel;
  coarse: boolean;
  locale: Locale;
  t: Translate;
  onPick: (subjectId: string) => void;
}

// The queue and the subject in focus scroll together on a short screen, while the header
// and the action row stay in view.
function CardView({ model, coarse, locale, t, onPick }: CardViewProps) {
  const { checklist, current } = model;
  const queue = (
    <QueueChips
      rows={checklist?.rows ?? []}
      statuses={model.statuses}
      currentId={current?.subjectId ?? null}
      stale={model.stale}
      locale={locale}
      t={t}
      onPick={onPick}
    />
  );
  return current === null ? (
    <div className="kcp-scroll min-h-0 flex-1 overflow-y-auto kcp-fade-in">
      {queue}
    </div>
  ) : (
    <FocusSection
      queue={queue}
      model={model}
      row={current}
      status={model.statuses[current.subjectId] ?? 'todo'}
      coarse={coarse}
      locale={locale}
      t={t}
    />
  );
}

export function HelperCard({ model }: { model: HelperModel }) {
  const { t, language } = useTranslation();
  const phone = !useMediaQuery(minWidthQuery(BREAKPOINTS.sm));
  const coarse = useMediaQuery(COARSE_POINTER_QUERY);
  const view = useStore(helperStore, (state) => state.view);
  const ref = useRef<HTMLElement>(null);
  // A press outside KCP collapses the card on a phone, so the keyboard or a host dialog
  // is never hidden behind it.
  useOutsidePress(ref, phone, collapse, true);
  const { checklist, current } = model;
  const list = view === 'list';
  const countLabel = t(model.sent ? 'regis.count.sent' : 'regis.short.added');
  const figure = `${String(model.done)}/${String(model.total)}`;

  const pick = (subjectId: string) => {
    setCurrent(subjectId);
  };
  // Leaving the list for a subject hands focus to that subject's chip.
  const backToCard = (subjectId: string) => {
    commitThenFocus(
      () => {
        setCurrent(subjectId);
        setView('card');
      },
      () => [
        ref.current?.querySelector<HTMLElement>('[data-status][aria-current]'),
      ],
    );
  };

  useEscapeInside(ref);

  return (
    <section
      ref={ref}
      id={CARD_ID}
      aria-label={t('regis.launcherEmpty')}
      lang={language}
      data-observer={model.observer}
      data-fill={model.run.status}
      className="kcp-regis-card z-host flex flex-col rounded-kcp border border-border bg-surface text-sm text-ink shadow-kcp"
    >
      {checklist === null || checklist.total === 0 ? (
        <div className="p-3">
          <EmptyState
            icon={CalendarDays}
            title={t('regis.noPlan')}
            description={t('regis.noPlanBody')}
            action={
              <button
                type="button"
                onClick={() => {
                  uiStore.getState().open();
                }}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-kcp bg-primary-strong px-3 text-sm font-semibold text-white hover:bg-primary-hover max-sm:min-h-11`}
              >
                <CalendarDays size={16} aria-hidden />
                {t('regis.openPlanner')}
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex min-h-10 shrink-0 items-center justify-between p-1">
            <button
              type="button"
              id={COUNT_ID}
              aria-expanded={list}
              aria-controls={LIST_ID}
              // The name keeps the visible count first and says what a press does.
              aria-label={`${countLabel} ${figure}, ${t(list ? 'regis.count.showCard' : 'regis.count.showList')}`}
              onClick={() => {
                setView(list ? 'card' : 'list');
              }}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-kcp px-2 text-ink-soft hover:bg-surface-alt hover:text-ink max-sm:min-h-11 ${FOCUS_RING}`}
            >
              <span className="text-xs">{countLabel}</span>{' '}
              <span
                className={`text-base font-semibold tabular-nums ${model.stale ? 'text-ink-muted' : 'text-ink'}`}
              >
                {figure}
              </span>
              {list ? (
                <ChevronsDownUp size={16} aria-hidden />
              ) : (
                <ChevronsUpDown size={16} aria-hidden />
              )}
            </button>
            <HelperMoreMenu model={model} t={t} />
          </div>
          <Bar model={model} t={t} />
          {list ? (
            <QueueList
              model={model}
              currentId={current?.subjectId ?? null}
              locale={language}
              t={t}
              onPick={backToCard}
            />
          ) : (
            <CardView
              model={model}
              coarse={coarse}
              locale={language}
              t={t}
              onPick={pick}
            />
          )}
        </>
      )}
    </section>
  );
}
