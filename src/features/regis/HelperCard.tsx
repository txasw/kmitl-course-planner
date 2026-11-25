// The registration helper card (ADR-0076, design C2): a compact white card that rises
// above the launcher at the bottom right, a labelled region that is never modal, so the
// page stays usable while it is open. Its header holds the count, which opens the list of
// every subject, and the more menu; under it sits at most one bar, for a page KCP cannot
// read, a page of another term, or a plan with nothing prepared; then the queue of
// subjects and the subject in focus. A page of a term the student has no plan for shows
// one empty state that offers to make that plan, and a plan with no subjects shows one
// that opens the planner; both keep the header's more menu, so the plan picker and Hide on
// this page stay in reach. Escape inside it collapses it to the
// launcher. On a phone a press anywhere on the page collapses it too, so the keyboard or a
// host dialog is never hidden behind it (kept from commit 036227e).

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
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
import { fillTemplate } from '@/lib/i18n/template';
import { termText, type Term } from '@/lib/routing/academicTerms';
import { FOCUS_RING } from '@/lib/ui/focus';
import {
  BREAKPOINTS,
  COARSE_POINTER_QUERY,
  minWidthQuery,
} from '@/lib/ui/breakpoints';
import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { switchOrCreatePlanForTerm } from '@/features/plans/switchPlanTerm';
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
// a plan with nothing prepared. Only the first can offer an action, Check again, and then
// the whole bar is that one press, its words included, so a tap on what the student reads
// is the Check again they meant. When no reading can help, on a host build KCP was not
// tested with or in a staff session, it is a plain bar that says so, with no control.
function Bar({ model, t }: { model: HelperModel; t: Translate }) {
  const [Icon, key, tone] = model.stale
    ? ([
        EyeOff,
        model.offReason === 'untestedBuild'
          ? 'regis.newHostBuild'
          : 'regis.unreadable',
        'bg-warn-soft text-warn',
      ] as const)
    : model.termMismatch
      ? ([
          CalendarClock,
          'regis.state.termMismatch',
          'bg-warn-soft text-warn',
        ] as const)
      : !model.hasKit
        ? ([
            ClipboardList,
            'regis.noKitShort',
            'bg-surface-alt text-ink-soft',
          ] as const)
        : [null, null, null];
  if (Icon === null) return null;
  const bar = `mx-1 mb-2 flex min-h-8 items-center gap-2 rounded-kcp-sm pl-2 text-xs font-semibold max-sm:min-h-11 ${tone}`;
  const words = (
    <>
      <Icon size={16} aria-hidden className="shrink-0" />
      <span
        id={model.stale ? STALE_TEXT_ID : undefined}
        className="flex-1 text-left"
      >
        {t(key)}
      </span>
    </>
  );
  if (!model.stale || !model.recheckable) {
    return <div className={`${bar} py-1 pr-2`}>{words}</div>;
  }
  return (
    // The name is the bar's own words, the state and then Check again, with a space
    // between them so the name and the visible text read alike.
    <button
      type="button"
      onClick={() => {
        hostStore.getState().recheck();
      }}
      className={`${bar} w-[calc(100%-0.5rem)] hover:brightness-95 ${FOCUS_RING}`}
    >
      {words}{' '}
      <span className="inline-flex shrink-0 items-center gap-1 px-2">
        <span className="max-sm:sr-only">{t('regis.recheck')}</span>
        <RefreshCw size={16} aria-hidden />
      </span>
    </button>
  );
}

const EMPTY_ACTION = `inline-flex min-h-9 items-center gap-1.5 rounded-kcp bg-primary-strong px-3 text-sm font-semibold text-white hover:bg-primary-hover max-sm:min-h-11 ${FOCUS_RING}`;

// An empty state keeps the header row with the more menu alone at its end, so a student
// who picked a plan with no subjects can pick another, and Hide on this page and Check
// again stay where they are on every other state of the card.
function EmptyCard({
  model,
  t,
  children,
}: {
  model: HelperModel;
  t: Translate;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex min-h-10 shrink-0 items-center justify-end p-1">
        <HelperMoreMenu model={model} t={t} />
      </div>
      <div className="px-3 pb-3">{children}</div>
    </>
  );
}

// The page registers a term the student has no plan for. Its one action makes a plan of
// that term and opens the planner on it, on the student's own press, so the active plan
// changes only when they ask.
function NoPlanForTerm({ term, t }: { term: Term; t: Translate }) {
  const values = { term: termText(term) };
  return (
    <EmptyState
      icon={CalendarClock}
      title={fillTemplate(t('regis.noPlanForTerm'), values)}
      description={fillTemplate(t('regis.noPlanForTermBody'), values)}
      action={
        <button
          type="button"
          onClick={() => {
            switchOrCreatePlanForTerm(term);
            uiStore.getState().open();
          }}
          className={EMPTY_ACTION}
        >
          <CalendarDays size={16} aria-hidden />
          {fillTemplate(t('regis.createPlanForTerm'), values)}
        </button>
      }
    />
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
      coarse={coarse}
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
      {model.pick.kind === 'noPlanForTerm' ? (
        <EmptyCard model={model} t={t}>
          <NoPlanForTerm term={model.pick.term} t={t} />
        </EmptyCard>
      ) : checklist === null || checklist.total === 0 ? (
        <EmptyCard model={model} t={t}>
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
                className={EMPTY_ACTION}
              >
                <CalendarDays size={16} aria-hidden />
                {t('regis.openPlanner')}
              </button>
            }
          />
        </EmptyCard>
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
