// The list view of the plan switcher menu: the create button, the saved plans grouped
// by term with their per row actions, and the JSON import and export row. It owns no
// state; the switcher decides what each action does.

import { useMemo } from 'react';
import {
  Check,
  Copy,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import type { Plan } from '@/lib/domain/plan';
import type { Term } from '@/lib/routing/academicTerms';
import type { Translate } from '@/lib/i18n/t';
import { useTranslation } from '@/features/shell/useTranslation';

interface TermGroup {
  key: string;
  term: Term;
  plans: Plan[];
}

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

export interface PlanListProps {
  plans: Plan[];
  activePlanId: string | null;
  /** False until the search form has a seeded year, since a plan needs a real term. */
  canCreate: boolean;
  onCreate: () => void;
  onSelect: (plan: Plan) => void;
  onRename: (plan: Plan) => void;
  onDuplicate: (plan: Plan) => void;
  onDelete: (plan: Plan) => void;
  onImport: () => void;
  /** Null when there is no active plan to export. */
  onExport: (() => void) | null;
}

export function PlanList({
  plans,
  activePlanId,
  canCreate,
  onCreate,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onImport,
  onExport,
}: PlanListProps) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupByTerm(plans), [plans]);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!canCreate}
        onClick={onCreate}
        className="flex w-full items-center justify-center gap-1.5 rounded-kcp bg-primary-strong px-2 py-1.5 text-sm font-medium text-white outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:hover:bg-primary-strong"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden />
        {t('planSwitcher.create')}
      </button>
      {groups.length === 0 ? (
        <p className="px-2 py-1 text-ink-soft">{t('planSwitcher.noPlan')}</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="flex flex-col">
            <p className="px-2 pt-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">
              {termLabel(group.term, t)}
            </p>
            {group.plans.map((plan) => (
              <div
                key={plan.id}
                className="group/row flex items-center gap-1 rounded-kcp hover:bg-surface-alt focus-within:bg-surface-alt"
              >
                <button
                  type="button"
                  aria-current={plan.id === activePlanId ? 'true' : undefined}
                  onClick={() => {
                    onSelect(plan);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-kcp px-2 py-1 text-left text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Check
                    size={14}
                    strokeWidth={2}
                    aria-hidden
                    className={`shrink-0 ${
                      plan.id === activePlanId
                        ? 'text-primary-strong'
                        : 'text-transparent'
                    }`}
                  />
                  <span className="truncate">{plan.name}</span>
                </button>
                {/* Per-row actions, revealed on hover and focus of the row; they
                    stay focusable so the keyboard reveals and reaches them. */}
                <div className="flex shrink-0 items-center gap-0.5 pr-1 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                  <ActionButton
                    icon={<Pencil size={14} strokeWidth={2} aria-hidden />}
                    label={`${t('planSwitcher.rename')} ${plan.name}`}
                    showLabel={false}
                    onClick={() => {
                      onRename(plan);
                    }}
                  />
                  <ActionButton
                    icon={<Copy size={14} strokeWidth={2} aria-hidden />}
                    label={`${t('planSwitcher.duplicate')} ${plan.name}`}
                    showLabel={false}
                    onClick={() => {
                      onDuplicate(plan);
                    }}
                  />
                  <ActionButton
                    icon={<Trash2 size={14} strokeWidth={2} aria-hidden />}
                    label={`${t('planSwitcher.delete')} ${plan.name}`}
                    showLabel={false}
                    onClick={() => {
                      onDelete(plan);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))
      )}
      <div className="mt-1 flex items-center gap-1 border-t border-border pt-1">
        <ActionButton
          icon={<Upload size={14} strokeWidth={2} aria-hidden />}
          label={t('planData.import')}
          onClick={onImport}
        />
        {onExport !== null ? (
          <ActionButton
            icon={<Download size={14} strokeWidth={2} aria-hidden />}
            label={t('planData.export')}
            onClick={onExport}
          />
        ) : null}
      </div>
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  /** When false the label is dropped and the button is icon only, still named by
   * its aria-label and its tooltip. Used for the per row plan actions. */
  showLabel?: boolean;
}

function ActionButton({
  icon,
  label,
  onClick,
  showLabel = true,
}: ActionButtonProps) {
  return (
    // The dropdown opens downward from the header, so the action row sits below the plan
    // list. A top placed tooltip would cover that list; point it below the icons, away
    // from the popover body, so it never hides the options being chosen.
    <Tooltip label={label} placement="bottom">
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          onClick={onClick}
          aria-label={label}
          className={`inline-flex items-center rounded-kcp py-1 font-medium text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            showLabel ? 'gap-1 px-2 text-xs' : 'px-1.5'
          }`}
        >
          {icon}
          {showLabel ? <span>{label}</span> : null}
        </button>
      )}
    </Tooltip>
  );
}
