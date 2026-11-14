// The plan switcher in the overlay header. It lists the saved plans grouped by term,
// switches the active plan, and creates, renames, duplicates, or deletes a plan.
// Switching a plan snaps the search form to that plan's term so the next search
// reflects it. A new plan offers the term the search tabs share and lets the user pick
// another, and creating it snaps the search form to that term. The dropdown is
// positioned with floating-ui, a fixed strategy that escapes the header, and
// dismisses on an outside click or Escape. Below 640 px a w-72 dropdown leaves almost
// no margin and its row actions sit under a thumb, so the same menu opens as a bottom
// sheet instead, which carries its own scrim, focus trap and Escape layer.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { useClick, useDismiss, useInteractions } from '@floating-ui/react';
import { planSchema, type Plan } from '@/lib/domain/plan';
import {
  buddhistYears,
  toBuddhistYear,
  yearsWith,
  type Term,
} from '@/lib/routing/academicTerms';
import { isTermReady } from '@/lib/search/formState';
import { planExportBaseName } from '@/lib/planner/exportName';
import { parsePlanImport } from '@/lib/plans/parsePlanImport';
import { downloadText } from '@/lib/utils/download';
import { searchStore } from '@/features/search/searchStore';
import { toastStore } from '@/features/shell/toastStore';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';
import { useLayoutTier } from '@/features/shell/useLayoutTier';
import { useTranslation } from '@/features/shell/useTranslation';
import { BottomSheet } from '@/components/BottomSheet';
import { FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT } from '@/lib/ui/target';
import { DeleteConfirm } from './DeleteConfirm';
import { ImportErrorView } from './ImportErrorView';
import { NameForm } from './NameForm';
import { PlanList, termLabel } from './PlanList';
import { planStore, useActivePlan } from './planStore';

type Mode =
  | { kind: 'list' }
  | {
      kind: 'create';
      value: string;
      term: Term;
      /** True once the name differs from the default for the chosen term, which
       * stops a term change from rewriting it. */
      edited: boolean;
    }
  | { kind: 'rename'; value: string; planId: string }
  | { kind: 'confirmDelete'; planId: string }
  | { kind: 'importError'; issues: string[] };

export function PlanSwitcher() {
  const { t } = useTranslation();
  const plans = useStore(planStore, (state) => state.plans);
  const activePlan = useActivePlan();
  // A new plan defaults to the one term every search tab shares, so the active tab
  // never decides it.
  const searchTerm = useStore(searchStore, (state) => state.term);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const sheet = useLayoutTier() === 'compact';
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A plan needs a real term or its sections could never be added; block create
  // until the search form has a seeded year.
  const canCreate = isTermReady(searchTerm);
  const spanYears = useMemo(
    () => buddhistYears(toBuddhistYear(new Date().getFullYear())),
    [],
  );

  const { refs, floatingStyles, context } = usePanelPopover({
    gap: 4,
    open,
    onOpenChange: (next) => {
      setOpen(next);
      if (!next) {
        setMode({ kind: 'list' });
      }
    },
    placement: 'bottom-start',
  });
  // The sheet portals outside the floating context, so an outside press dismiss would
  // read every tap inside it as outside; the sheet closes through its own scrim instead.
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { enabled: !sheet }),
  ]);

  const setReference = useCallback(
    (node: HTMLButtonElement | null) => {
      refs.setReference(node);
      triggerRef.current = node;
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMode({ kind: 'list' });
    triggerRef.current?.focus();
  }, []);

  // The overlay traps focus and closes on Escape through a native body listener
  // that fires before floating-ui's dismiss. Intercept Escape on the dropdown so it
  // dismisses the menu only, keeping any in-progress name text and the overlay open.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const node = wrapperRef.current;
    if (node === null) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeMenu();
      }
    };
    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeMenu]);

  const defaultName = (term: Term): string =>
    `${t('plan.untitled')} ${term.semester}/${term.year}`;

  const snapToActivePlan = () => {
    const state = planStore.getState();
    const active = state.plans.find((plan) => plan.id === state.activePlanId);
    if (active !== undefined) {
      searchStore
        .getState()
        .seedTerm({ year: active.year, semester: active.semester });
    }
  };

  const selectPlan = (plan: Plan) => {
    planStore.getState().setActivePlan(plan.id);
    // Snap the search term to the plan so the next search reflects it.
    searchStore
      .getState()
      .seedTerm({ year: plan.year, semester: plan.semester });
    closeMenu();
  };

  const submitName = (value: string) => {
    const name = value.trim();
    if (name === '') {
      return;
    }
    if (mode.kind === 'create') {
      planStore.getState().createPlan(name, mode.term);
      // The chosen term may differ from the search form's; snap the form to the new
      // plan as a switch does, so the next search can add to it.
      snapToActivePlan();
    } else if (mode.kind === 'rename') {
      planStore.getState().renamePlan(mode.planId, name);
    }
    closeMenu();
  };

  const handleExport = () => {
    if (activePlan === null) {
      return;
    }
    const result = planSchema.safeParse(activePlan);
    if (!result.success) {
      toastStore.getState().show('error', t('planData.exportFailed'));
      return;
    }
    downloadText(
      `${planExportBaseName(activePlan)}.json`,
      JSON.stringify(result.data, null, 2),
    );
    toastStore.getState().show('success', t('planData.exported'));
    closeMenu();
  };

  // Validate the imported blob at the trust boundary and, on any issue, list the
  // exact failing fields without committing anything. On success importPlan lands a
  // new unverified plan that revalidation reconciles on first open.
  const importText = (text: string) => {
    const result = parsePlanImport(text, t);
    if (!result.ok) {
      setMode({ kind: 'importError', issues: result.error });
      return;
    }
    planStore.getState().importPlan(result.value);
    snapToActivePlan();
    closeMenu();
    toastStore.getState().show('success', t('planData.imported'));
  };

  const triggerLabel =
    activePlan === null ? t('planSwitcher.noPlan') : activePlan.name;

  const menu =
    mode.kind === 'create' ? (
      <NameForm
        value={mode.value}
        label={t('planSwitcher.nameLabel')}
        save={t('planSwitcher.save')}
        cancel={t('action.cancel')}
        term={{
          value: mode.term,
          // Offered from the term the form shows, which can sit outside the span and
          // stays put if the search term moves while the form is open.
          years: yearsWith(spanYears, mode.term.year),
          onChange: (term) => {
            setMode({
              ...mode,
              term,
              value: mode.edited ? mode.value : defaultName(term),
            });
          },
        }}
        onChange={(value) => {
          setMode({
            ...mode,
            value,
            edited: value !== defaultName(mode.term),
          });
        }}
        onSubmit={() => {
          submitName(mode.value);
        }}
        onCancel={() => {
          setMode({ kind: 'list' });
        }}
      />
    ) : mode.kind === 'rename' ? (
      <NameForm
        value={mode.value}
        label={t('planSwitcher.nameLabel')}
        save={t('planSwitcher.save')}
        cancel={t('action.cancel')}
        onChange={(value) => {
          setMode({ ...mode, value });
        }}
        onSubmit={() => {
          submitName(mode.value);
        }}
        onCancel={() => {
          setMode({ kind: 'list' });
        }}
      />
    ) : mode.kind === 'confirmDelete' ? (
      <DeleteConfirm
        planName={plans.find((plan) => plan.id === mode.planId)?.name ?? ''}
        onCancel={() => {
          setMode({ kind: 'list' });
        }}
        onConfirm={() => {
          planStore.getState().deletePlan(mode.planId);
          // The fallback plan may be a different term; snap the form to it.
          snapToActivePlan();
          setMode({ kind: 'list' });
        }}
      />
    ) : mode.kind === 'importError' ? (
      <ImportErrorView
        issues={mode.issues}
        onBack={() => {
          setMode({ kind: 'list' });
        }}
      />
    ) : (
      <PlanList
        plans={plans}
        activePlanId={activePlan?.id ?? null}
        canCreate={canCreate}
        onCreate={() => {
          setMode({
            kind: 'create',
            value: defaultName(searchTerm),
            term: searchTerm,
            edited: false,
          });
        }}
        onSelect={selectPlan}
        onRename={(plan) => {
          setMode({
            kind: 'rename',
            value: plan.name,
            planId: plan.id,
          });
        }}
        onDuplicate={(plan) => {
          planStore
            .getState()
            .duplicatePlan(
              plan.id,
              `${plan.name} (${t('planSwitcher.copySuffix')})`,
            );
          snapToActivePlan();
          closeMenu();
        }}
        onDelete={(plan) => {
          setMode({ kind: 'confirmDelete', planId: plan.id });
        }}
        onImport={() => {
          fileInputRef.current?.click();
        }}
        onExport={activePlan !== null ? handleExport : null}
      />
    );

  // The wrapper is the header item that shrinks first, so the trigger fills it and its
  // plan name and term truncate before any other header control gives way. Below 640 px
  // the calendar icon drops out so the name keeps the room, and at the narrowest width
  // the trigger narrows to its chevron. It keeps the target height but sets no minimum
  // width, which would push it over its neighbours.
  return (
    <div ref={wrapperRef} className="relative min-w-0 max-w-[16rem]">
      <button
        ref={setReference}
        type="button"
        {...getReferenceProps()}
        aria-label={t('planSwitcher.label')}
        aria-haspopup={sheet ? 'dialog' : 'true'}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 overflow-hidden rounded-kcp border border-border px-2 py-px text-sm text-ink hover:bg-surface-alt sm:px-3 ${TARGET_HEIGHT} ${FOCUS_RING}`}
      >
        <CalendarRange
          size={16}
          strokeWidth={2}
          aria-hidden
          className="hidden shrink-0 text-ink-soft sm:block"
        />
        <span className="flex min-w-0 flex-1 flex-col items-start text-left">
          <span className="max-w-full truncate">{triggerLabel}</span>
          {activePlan === null ? null : (
            <span className="max-w-full truncate text-2xs text-ink-soft">
              {termLabel(activePlan, t)}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 text-ink-soft"
        />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        aria-label={t('planData.import')}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear the value so re-importing the same file fires change again.
          event.target.value = '';
          if (file !== undefined) {
            void file.text().then(importText);
          }
        }}
      />
      {open && sheet ? (
        <BottomSheet
          title={t('planSwitcher.label')}
          closeLabel={t('action.close')}
          onClose={closeMenu}
        >
          {menu}
        </BottomSheet>
      ) : null}
      {open && !sheet ? (
        <div
          ref={setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          className={`z-popover w-72 ${PANEL_POPOVER_SCROLL} rounded-kcp border border-border bg-surface p-2 text-sm shadow-kcp`}
        >
          {menu}
        </div>
      ) : null}
    </div>
  );
}
