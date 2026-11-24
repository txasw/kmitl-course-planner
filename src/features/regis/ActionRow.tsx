// The controls of the action row on the helper card: Copy ID, the disabled form of Add
// for me with its reason, Other section, and Use section in plan. Add for me itself and
// Stop live with the fill controls, the only code that may start a run.

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Check, ChevronDown, Copy, Plus } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import { fillTemplate } from '@/lib/i18n/template';
import type { Translate } from '@/lib/i18n/t';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { toastStore } from '@/features/shell/toastStore';
import { ACTION_BUTTON } from './fill/FillControls';
import { announce } from './helperStore';
import type { SectionTrigger } from './SectionListbox';

const SECONDARY = `${ACTION_BUTTON} border border-border bg-surface text-ink hover:bg-surface-alt ${FOCUS_RING}`;

const COPIED_MS = 2000;

export function CopyIdButton({
  subjectId,
  t,
}: {
  subjectId: string;
  t: Translate;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={fillTemplate(t('regis.copyId'), { subjectId })}
      onClick={() => {
        navigator.clipboard.writeText(subjectId).then(
          () => {
            setCopied(true);
            announce(fillTemplate(t('regis.copiedAnnounce'), { subjectId }));
          },
          () => {
            toastStore.getState().show('error', t('block.copySubjectIdFailed'));
          },
        );
      }}
      className={SECONDARY}
    >
      {copied ? (
        <Check size={16} aria-hidden className="shrink-0 text-success" />
      ) : (
        <Copy size={16} aria-hidden className="shrink-0" />
      )}
      <span>{t(copied ? 'regis.copied' : 'regis.copy')}</span>
    </button>
  );
}

/**
 * Add for me while it cannot run: still focusable, with the reason linked to it, shown as
 * a tooltip under a fine pointer and as a line under the row on touch, where no tooltip
 * shows. It starts nothing. On a list row it is the plus icon alone, named with the
 * subject and the reason.
 */
export function BlockedAddButton({
  reason,
  reasonId,
  coarse,
  subjectId,
  t,
}: {
  reason: string;
  reasonId?: string;
  coarse: boolean;
  /** The subject of a list row, which shows the icon alone. */
  subjectId?: string;
  t: Translate;
}) {
  const label = t('regis.addForMe');
  return (
    <Tooltip label={reason} disabled={coarse}>
      {(triggerProps, ref) => (
        <button
          ref={ref}
          {...triggerProps}
          type="button"
          aria-disabled="true"
          aria-describedby={reasonId}
          aria-label={
            subjectId === undefined
              ? undefined
              : `${label} ${subjectId}, ${reason}`
          }
          className={`${
            subjectId === undefined
              ? ACTION_BUTTON
              : 'inline-flex size-11 items-center justify-center rounded-kcp sm:size-9'
          } cursor-not-allowed bg-surface-alt text-ink-muted ring-1 ring-border ring-inset ${FOCUS_RING}`}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden className="shrink-0" />
          {subjectId === undefined ? <span>{label}</span> : null}
        </button>
      )}
    </Tooltip>
  );
}

export function PickOtherButton({
  trigger,
  t,
}: {
  trigger: SectionTrigger;
  t: Translate;
}) {
  return (
    <button
      {...trigger.props}
      type="button"
      // A combobox takes no name from its content, so the visible label is stated.
      aria-label={t('regis.pickOther')}
      className={`${ACTION_BUTTON} bg-primary-strong font-semibold text-white hover:bg-primary-hover ${FOCUS_OUTLINE}`}
    >
      <span>{t('regis.pickOther')}</span>
      <ChevronDown size={16} aria-hidden className="shrink-0" />
    </button>
  );
}

export function UseInPlanButton({
  codes,
  onSave,
  t,
}: {
  codes: string;
  onSave: () => void;
  t: Translate;
}) {
  return (
    <button type="button" onClick={onSave} className={SECONDARY}>
      <ArrowLeftRight size={16} aria-hidden className="shrink-0" />
      <span>{fillTemplate(t('regis.useInPlan'), { codes })}</span>
    </button>
  );
}
