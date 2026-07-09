// The plan switcher in the overlay header. It lists the saved plans grouped by term,
// switches the active plan, and creates, renames, duplicates, or deletes a plan.
// Switching a plan snaps the search form to that plan's term so the next search
// reflects it. A new plan takes the current search term. The dropdown is positioned
// with floating-ui, a fixed strategy that escapes the header, and dismisses on an
// outside click or Escape.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  CalendarRange,
  Check,
  ChevronDown,
  Copy,
  Pencil,
  Plus,
  Trash2,
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
  useRole,
} from '@floating-ui/react';
import type { Plan } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';
import type { Translate } from '@/lib/i18n/t';
import { searchStore } from '@/features/search/searchStore';
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
  | { kind: 'confirmDelete' };

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

/** The term the search form currently targets, used as a new plan's default term. */
function currentSearchTerm(): Term {
  const state = searchStore.getState();
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
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

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
    useRole(context, { role: 'menu' }),
  ]);

  const setReference = useCallback(
    (node: HTMLButtonElement | null) => {
      refs.setReference(node);
    },
    [refs],
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  const groups = useMemo(() => groupByTerm(plans), [plans]);

  const defaultName = (term: Term): string =>
    `${t('plan.untitled')} ${term.semester}/${term.year}`;

  const selectPlan = (plan: Plan) => {
    planStore.getState().setActivePlan(plan.id);
    // Snap the search term to the plan so the next search reflects it.
    searchStore
      .getState()
      .seedTerm({ year: plan.year, semester: plan.semester });
    setOpen(false);
    setMode({ kind: 'list' });
  };

  const submitName = (value: string) => {
    const name = value.trim();
    if (mode.kind !== 'name' || name === '') {
      return;
    }
    if (mode.action === 'create') {
      planStore.getState().createPlan(name, currentSearchTerm());
    } else if (activePlan !== null) {
      planStore.getState().renamePlan(activePlan.id, name);
    }
    setMode({ kind: 'list' });
    setOpen(false);
  };

  const triggerLabel =
    activePlan === null ? t('planSwitcher.noPlan') : activePlan.name;

  return (
    <div className="relative">
      <button
        ref={setReference}
        type="button"
        aria-label={t('planSwitcher.label')}
        {...getReferenceProps()}
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
                    setMode({ kind: 'list' });
                  }}
                  className="rounded-kcp bg-danger px-2 py-1 font-medium text-white outline-none hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t('planSwitcher.delete')}
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
                              ? 'text-primary'
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
                  onClick={() => {
                    setMode({
                      kind: 'name',
                      action: 'create',
                      value: defaultName(currentSearchTerm()),
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
                        setOpen(false);
                        setMode({ kind: 'list' });
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
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1 rounded-kcp px-2 py-1 text-xs font-medium text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
          className="rounded-kcp bg-primary px-2 py-1 font-medium text-white outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          {save}
        </button>
      </div>
    </div>
  );
}
