// The plan switcher in the overlay header. It lists the saved plans grouped by term,
// switches the active plan, and creates, renames, duplicates, or deletes a plan.
// Switching a plan snaps the search form to that plan's term so the next search
// reflects it. A new plan takes the current search term. The dropdown is positioned
// with floating-ui, a fixed strategy that escapes the header, and dismisses on an
// outside click or Escape.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ChevronDown,
  Copy,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { planSchema, type Plan } from '@/lib/domain/plan';
import { importIssueMessages } from '@/lib/domain/importIssues';
import type { Term } from '@/lib/routing/academicTerms';
import type { Translate } from '@/lib/i18n/t';
import { planExportBaseName } from '@/lib/planner/exportName';
import { downloadText } from '@/lib/utils/download';
import { searchStore, type SearchStore } from '@/features/search/searchStore';
import { toastStore } from '@/features/shell/toastStore';
import { useTranslation } from '@/features/shell/useTranslation';
import { planStore, useActivePlan } from './planStore';

interface TermGroup {
  key: string;
  term: Term;
  plans: Plan[];
}

type Mode =
  | { kind: 'list' }
  | { kind: 'name'; action: 'create' | 'rename'; value: string }
  | { kind: 'confirmDelete' }
  | { kind: 'importError'; issues: string[] };

function termLabel(term: Term, t: Translate): string {
  return `${t('search.semester')} ${term.semester}/${term.year}`;
}

function groupByTerm(plans: Plan[]): TermGroup[] {
  const groups = new Map<string, TermGroup>();
  for (const plan of plans) {
    const key = `${plan.year}-${plan.semester}`;
    let group = groups.get(key);
    if (group === undefined) {
      group = {
        key,
        term: { year: plan.year, semester: plan.semester },
        plans: [],
      };
      groups.set(key, group);
    }
    group.plans.push(plan);
  }
  return [...groups.values()];
}

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

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      setOpen(next);
      if (!next) {
        setMode({ kind: 'list' });
      }
    },
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
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

  const groups = useMemo(() => groupByTerm(plans), [plans]);

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
    } else if (activePlan !== null) {
      planStore.getState().renamePlan(activePlan.id, name);
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      setMode({ kind: 'importError', issues: [t('planData.invalidJson')] });
      return;
    }
    const result = planSchema.safeParse(parsed);
    if (!result.success) {
      setMode({
        kind: 'importError',
        issues: importIssueMessages(result.error, parsed, t),
      });
      return;
    }
    planStore.getState().importPlan(result.data);
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
          className="z-50 w-72 rounded-kcp border border-border bg-surface p-2 text-sm shadow-kcp"
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
          ) : mode.kind === 'confirmDelete' && activePlan !== null ? (
            <div className="flex flex-col gap-2">
              <p className="text-ink">
                {t('planSwitcher.deletePrompt')} {activePlan.name}
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
                    planStore.getState().deletePlan(activePlan.id);
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
            <div className="flex flex-col gap-1">
              {groups.length === 0 ? (
                <p className="px-2 py-1 text-ink-soft">
                  {t('planSwitcher.noPlan')}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.key} className="flex flex-col">
                    <p className="px-2 pt-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                      {termLabel(group.term, t)}
                    </p>
                    {group.plans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        aria-current={
                          plan.id === activePlan?.id ? 'true' : undefined
                        }
                        onClick={() => {
                          selectPlan(plan);
                        }}
                        className="flex items-center gap-2 rounded-kcp px-2 py-1 text-left text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <Check
                          size={14}
                          strokeWidth={2}
                          aria-hidden
                          className={`shrink-0 ${
                            plan.id === activePlan?.id
                              ? 'text-primary-strong'
                              : 'text-transparent'
                          }`}
                        />
                        <span className="truncate">{plan.name}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
              <div className="mt-1 flex items-center gap-1 border-t border-border pt-1">
                <ActionButton
                  icon={<Plus size={14} strokeWidth={2} aria-hidden />}
                  label={t('planSwitcher.create')}
                  disabled={!canCreate}
                  onClick={() => {
                    setMode({
                      kind: 'name',
                      action: 'create',
                      value: defaultName(searchTerm),
                    });
                  }}
                />
                {activePlan !== null ? (
                  <>
                    <ActionButton
                      icon={<Pencil size={14} strokeWidth={2} aria-hidden />}
                      label={t('planSwitcher.rename')}
                      onClick={() => {
                        setMode({
                          kind: 'name',
                          action: 'rename',
                          value: activePlan.name,
                        });
                      }}
                    />
                    <ActionButton
                      icon={<Copy size={14} strokeWidth={2} aria-hidden />}
                      label={t('planSwitcher.duplicate')}
                      onClick={() => {
                        planStore
                          .getState()
                          .duplicatePlan(
                            activePlan.id,
                            `${activePlan.name} (${t('planSwitcher.copySuffix')})`,
                          );
                        snapToActivePlan();
                        closeMenu();
                      }}
                    />
                    <ActionButton
                      icon={<Trash2 size={14} strokeWidth={2} aria-hidden />}
                      label={t('planSwitcher.delete')}
                      onClick={() => {
                        setMode({ kind: 'confirmDelete' });
                      }}
                    />
                  </>
                ) : null}
              </div>
              <div className="mt-1 flex items-center gap-1 border-t border-border pt-1">
                <ActionButton
                  icon={<Upload size={14} strokeWidth={2} aria-hidden />}
                  label={t('planData.import')}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                />
                {activePlan !== null ? (
                  <ActionButton
                    icon={<Download size={14} strokeWidth={2} aria-hidden />}
                    label={t('planData.export')}
                    onClick={handleExport}
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 rounded-kcp px-2 py-1 text-xs font-medium text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function NameForm({
  value,
  label,
  save,
  cancel,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  label: string;
  save: string;
  cancel: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus the field on open so the user can name the plan straight away, done
  // through a ref rather than autoFocus to satisfy the accessibility lint.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-ink">
        <span className="font-medium">{label}</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit();
            }
          }}
          className="rounded-kcp border border-border bg-surface px-2 py-1 text-ink focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-kcp border border-border px-2 py-1 font-medium text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {cancel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.trim() === ''}
          className="rounded-kcp bg-primary-strong px-2 py-1 font-medium text-white outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          {save}
        </button>
      </div>
    </div>
  );
}
