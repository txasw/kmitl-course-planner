// The registration helper beside the host's registration page (ADR-0076). It is not
// modal: no focus trap, no scroll lock, no backdrop, so the page stays usable while it is
// open, and the full planner stays one action away, which hides the dock while it is
// open. On a desktop it is a dock on the right edge, open in full from 1440 px and a
// narrow bar below that the student can expand. On a phone it is a bottom sheet with a
// peek bar, raised to half or full height on demand; at rest only the peek bar shows, so
// it sits below a host dialog's buttons rather than over them, and a press anywhere on
// the page lowers a raised sheet to that bar, so the dialog a press on Continue opens is
// never hidden behind it.

import { useEffect, useRef, type RefObject } from 'react';
import { useStore } from 'zustand';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  ListChecks,
  X,
} from 'lucide-react';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import { BREAKPOINTS, minWidthQuery } from '@/lib/ui/breakpoints';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_SIZE } from '@/lib/ui/target';
import { copySubjectId } from '@/features/planner/copySubjectId';
import { LAUNCHER_ID } from '@/features/shell/Launcher';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { rootOf } from '@/features/shell/useFocusTrap';
import { uiStore } from '@/features/shell/uiStore';
import { useMediaQuery } from '@/features/shell/useMediaQuery';
import { useTranslation } from '@/features/shell/useTranslation';
import { DockContent } from './DockContent';
import { regisStore, type SheetLevel } from './regisStore';
import { useCompanionRoute, useCompanionView } from './useCompanion';

/** The width from which the dock opens in full rather than as the narrow bar. */
const DOCK_FULL_WIDTH = 1440;

const ICON_BUTTON = `flex shrink-0 items-center justify-center rounded-kcp text-ink-soft hover:bg-surface-alt hover:text-ink ${TARGET_SIZE} ${FOCUS_RING}`;

// Closing hands focus to the launcher, which shows again once the dock is gone, so focus
// never falls back to the host page.
function closeDock(from: HTMLElement) {
  const root = rootOf(from);
  commitThenFocus(
    () => {
      regisStore.getState().setDockOpen(false);
    },
    () => [root?.getElementById(LAUNCHER_ID)],
  );
}

function CloseButton({ t }: { t: Translate }) {
  return (
    <button
      type="button"
      aria-label={t('action.close')}
      onClick={(event) => {
        closeDock(event.currentTarget);
      }}
      className={ICON_BUTTON}
    >
      <X size={18} aria-hidden />
    </button>
  );
}

function ProgressLabel({
  done,
  total,
  t,
}: {
  done: number;
  total: number;
  t: Translate;
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold">
      <ListChecks size={18} aria-hidden />
      {fillTemplate(t('regis.launcher'), { done, total })}
    </span>
  );
}

export function CompanionDock() {
  const route = useCompanionRoute();
  const overlayOpen = useStore(uiStore, (state) => state.isOpen);
  const dockOpen = useStore(regisStore, (state) => state.dockOpen);
  const desktop = useMediaQuery(minWidthQuery(BREAKPOINTS.sm));
  if (route === null || overlayOpen || !dockOpen) return null;
  return desktop ? <DesktopDock /> : <PhoneSheet />;
}

function useDockBody() {
  const route = useCompanionRoute();
  const view = useCompanionView();
  const { t, language } = useTranslation();
  const body =
    route === null ? null : (
      <DockContent
        route={route}
        plan={view.plan}
        checklist={view.checklist}
        kit={view.kit}
        storedKit={view.storedKit}
        kitState={view.kitState}
        locale={language}
        t={t}
      />
    );
  return {
    body,
    t,
    language,
    done: view.checklist?.done ?? 0,
    total: view.checklist?.total ?? 0,
    next: view.checklist?.rows.find((row) => row.state === 'notDone') ?? null,
  };
}

function setExpanded(next: boolean) {
  regisStore.getState().setDockExpanded(next);
}

function DesktopDock() {
  const wide = useMediaQuery(minWidthQuery(DOCK_FULL_WIDTH));
  const chosen = useStore(regisStore, (state) => state.dockExpanded);
  const expanded = chosen ?? wide;
  const { body, t, language, done, total } = useDockBody();
  // Escape collapses the dock only while focus is inside it, so the host page keeps
  // its own Escape everywhere else.
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = asideRef.current;
    if (!expanded || node === null) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setExpanded(false);
      }
    };
    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded]);

  if (!expanded) {
    return (
      <aside
        aria-label={t('regis.title')}
        lang={language}
        className="fixed top-24 right-(--kcp-safe-right) z-host flex flex-col items-center gap-1 rounded-l-kcp border border-r-0 border-border bg-surface p-1 text-ink shadow-kcp"
      >
        <button
          type="button"
          aria-label={t('regis.expand')}
          onClick={() => {
            setExpanded(true);
          }}
          className={ICON_BUTTON}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <ListChecks size={18} aria-hidden className="text-ink-soft" />
        <span className="text-xs font-semibold tabular-nums">
          {done}/{total}
        </span>
        <CloseButton t={t} />
      </aside>
    );
  }

  return (
    <aside
      aria-label={t('regis.title')}
      lang={language}
      ref={asideRef}
      className="fixed top-0 right-0 bottom-0 z-host flex w-[360px] max-w-full flex-col border-l border-border bg-surface pr-(--kcp-safe-right) text-ink shadow-kcp"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border py-1 pr-1 pl-3">
        <h2 className="min-w-0 flex-1 text-sm font-semibold">
          {t('regis.title')}
        </h2>
        <button
          type="button"
          aria-label={t('regis.collapse')}
          onClick={() => {
            setExpanded(false);
          }}
          className={ICON_BUTTON}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
        <CloseButton t={t} />
      </div>
      <div className="kcp-scroll min-h-0 flex-1 overflow-y-auto">{body}</div>
    </aside>
  );
}

const SHEET_HEIGHT: Record<SheetLevel, string> = {
  peek: '',
  half: 'h-[50dvh]',
  full: 'h-[90dvh]',
};

const RAISE: Record<SheetLevel, SheetLevel> = {
  peek: 'half',
  half: 'full',
  full: 'full',
};
const LOWER: Record<SheetLevel, SheetLevel> = {
  peek: 'peek',
  half: 'peek',
  full: 'half',
};

// Lowers a raised sheet to its peek bar on a press outside KCP. It only compares the
// press target with KCP's own nodes and never reads or changes the page. A press inside
// KCP's closed shadow root reaches the document retargeted to the shadow host, and a
// press inside the sheet itself, where no shadow root wraps it, carries the sheet in its
// path.
function useLowerOnOutsidePress(
  ref: RefObject<HTMLElement | null>,
  raised: boolean,
) {
  useEffect(() => {
    const node = ref.current;
    if (!raised || node === null) return undefined;
    const root = rootOf(node);
    const host = root instanceof ShadowRoot ? root.host : null;
    const doc = node.ownerDocument;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target === host || event.composedPath().includes(node)) return;
      regisStore.getState().setSheetLevel('peek');
    };
    doc.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      doc.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [ref, raised]);
}

function PhoneSheet() {
  const level = useStore(regisStore, (state) => state.sheetLevel);
  const { body, t, language, done, total, next } = useDockBody();
  const asideRef = useRef<HTMLElement>(null);
  useLowerOnOutsidePress(asideRef, level !== 'peek');
  const progress = fillTemplate(t('regis.launcher'), { done, total });
  const setLevel = (next: SheetLevel) => {
    regisStore.getState().setSheetLevel(next);
  };
  return (
    <aside
      aria-label={t('regis.title')}
      lang={language}
      ref={asideRef}
      className={`fixed inset-x-0 bottom-0 z-host flex flex-col rounded-t-kcp border-t border-border bg-surface pr-(--kcp-safe-right) pb-(--kcp-safe-bottom) pl-(--kcp-safe-left) text-ink shadow-kcp ${SHEET_HEIGHT[level]}`}
    >
      <div className="flex min-h-16 shrink-0 items-center gap-1 px-2">
        <button
          type="button"
          aria-expanded={level !== 'peek'}
          aria-label={`${progress} ${t(
            level === 'full' ? 'regis.sheetLower' : 'regis.sheetRaise',
          )}`}
          onClick={() => {
            setLevel(level === 'full' ? LOWER[level] : RAISE[level]);
          }}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-kcp px-2 text-left ${TARGET_SIZE} ${FOCUS_RING}`}
        >
          <ProgressLabel done={done} total={total} t={t} />
          {level === 'full' ? (
            <ChevronDown size={18} aria-hidden className="ml-auto" />
          ) : (
            <ChevronUp size={18} aria-hidden className="ml-auto" />
          )}
        </button>
        {level === 'peek' && total > 0 ? (
          next === null ? (
            <span className="shrink-0 text-xs text-ink-soft">
              {t('regis.allDone')}
            </span>
          ) : (
            <button
              type="button"
              aria-label={fillTemplate(t('regis.copyId'), {
                subjectId: next.subjectId,
              })}
              onClick={() => {
                copySubjectId(next.subjectId, t);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-kcp border border-border px-2 text-xs font-semibold ${TARGET_SIZE} ${FOCUS_RING}`}
            >
              <Copy size={14} aria-hidden />
              {fillTemplate(t('regis.next'), { subjectId: next.subjectId })}
            </button>
          )
        ) : null}
        {level !== 'peek' ? (
          <button
            type="button"
            aria-label={t('regis.sheetLower')}
            onClick={() => {
              setLevel('peek');
            }}
            className={ICON_BUTTON}
          >
            <ChevronDown size={18} aria-hidden />
          </button>
        ) : null}
        <CloseButton t={t} />
      </div>
      {level === 'peek' ? null : (
        <div className="kcp-scroll min-h-0 flex-1 overflow-y-auto border-t border-border">
          {body}
        </div>
      )}
    </aside>
  );
}
