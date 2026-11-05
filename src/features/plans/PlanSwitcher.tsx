// The plan switcher in the overlay header. It lists the saved plans grouped by term,
// switches the active plan, and creates, renames, duplicates, or deletes a plan.
// Switching a plan snaps the search form to that plan's term so the next search
// reflects it. A new plan takes the current search term. The dropdown is positioned
// with floating-ui, a fixed strategy that escapes the header, and dismisses on an
// outside click or Escape.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { AlertTriangle, CalendarRange, ChevronDown } from 'lucide-react';
import { useClick, useDismiss, useInteractions } from '@floating-ui/react';
import { planSchema, type Plan } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';
import { planExportBaseName } from '@/lib/planner/exportName';
import { parsePlanImport } from '@/lib/plans/parsePlanImport';
import { downloadText } from '@/lib/utils/download';
import { searchStore, type SearchStore } from '@/features/search/searchStore';
import { toastStore } from '@/features/shell/toastStore';
import {
  PANEL_POPOVER_SCROLL,
  usePanelPopover,
} from '@/features/shell/usePanelPopover';
import { useTranslation } from '@/features/shell/useTranslation';
import { NameForm } from './NameForm';
import { PlanList } from './PlanList';
import { planStore, useActivePlan } from './planStore';

type Mode =
  | { kind: 'list' }
  | {
      kind: 'name';
      action: 'create' | 'rename';
      value: string;
      /** The plan a rename targets; absent for a create. */
      planId?: string;
    }
  | { kind: 'confirmDelete'; planId: string }
  | { kind: 'importError'; issues: string[] };

/** The term the active search tab targets, used as a new plan's default term. */
function searchFormTerm(state: SearchStore): Term {
  const form =
    state.activeTab === 'by_class'
      ? state.byClass
      : state.activeTab === 'by_subject_id'
        ? state.bySubjectId
        : state.byCategory;
  return { year: form.year, semester: form.semester };
}

export function PlanSwitcher() {
  const { t } = useTranslation();
  const plans = useStore(planStore, (state) => state.plans);
  const activePlan = useActivePlan();
  const searchYear = useStore(
    searchStore,
    (state) => searchFormTerm(state).year,
  );
  const searchSemester = useStore(
    searchStore,
    (state) => searchFormTerm(state).semester,
  );
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchTerm = useMemo<Term>(
    () => ({ year: searchYear, semester: searchSemester }),
    [searchYear, searchSemester],
  );
  // A plan needs a real term or its sections could never be added; block create
  // until the search form has a seeded year.
  const canCreate = searchYear !== '';

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
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
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

  // The overlay traps focus and closes on Escape through a native panel listener
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
    if (mode.kind !== 'name' || name === '') {
      return;
    }
    if (mode.action === 'create') {
      planStore.getState().createPlan(name, searchTerm);
    } else if (mode.planId !== undefined) {
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

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={setReference}
        type="button"
        {...getReferenceProps()}
        aria-label={t('planSwitcher.label')}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex max-w-[16rem] items-center gap-2 rounded-kcp border border-border px-3 py-1.5 text-sm text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <CalendarRange
          size={16}
          strokeWidth={2}
          aria-hidden
          className="shrink-0 text-ink-soft"
        />
        <span className="truncate">{triggerLabel}</span>
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
      {open ? (
        <div
          ref={setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          className={`z-popover w-72 ${PANEL_POPOVER_SCROLL} rounded-kcp border border-border bg-surface p-2 text-sm shadow-kcp`}
        >
          {mode.kind === 'name' ? (
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
            <div className="flex flex-col gap-2">
              <p className="text-ink">
                {t('planSwitcher.deletePrompt')}{' '}
                {plans.find((plan) => plan.id === mode.planId)?.name ?? ''}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode({ kind: 'list' });
                  }}
                  className="rounded-kcp border border-border px-2 py-1 font-medium text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t('action.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    planStore.getState().deletePlan(mode.planId);
                    // The fallback plan may be a different term; snap the form to it.
                    snapToActivePlan();
                    setMode({ kind: 'list' });
                  }}
                  className="rounded-kcp bg-danger px-2 py-1 font-medium text-white outline-none hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t('planSwitcher.delete')}
                </button>
              </div>
            </div>
          ) : mode.kind === 'importError' ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 font-medium text-ink">
                <AlertTriangle
                  size={16}
                  strokeWidth={2}
                  className="shrink-0 text-danger"
                  aria-hidden
                />
                {t('planData.errorTitle')}
              </p>
              <ul className="flex max-h-48 flex-col gap-1 overflow-auto kcp-scroll text-xs text-danger">
                {mode.issues.map((issue, index) => (
                  <li key={`${String(index)}-${issue}`}>{issue}</li>
                ))}
              </ul>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode({ kind: 'list' });
                  }}
                  className="rounded-kcp border border-border px-2 py-1 font-medium text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t('action.back')}
                </button>
              </div>
            </div>
          ) : (
            <PlanList
              plans={plans}
              activePlanId={activePlan?.id ?? null}
              canCreate={canCreate}
              onCreate={() => {
                setMode({
                  kind: 'name',
                  action: 'create',
                  value: defaultName(searchTerm),
                });
              }}
              onSelect={selectPlan}
              onRename={(plan) => {
                setMode({
                  kind: 'name',
                  action: 'rename',
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
          )}
        </div>
      ) : null}
    </div>
  );
}
