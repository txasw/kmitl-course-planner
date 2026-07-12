// The block detail popover, edit mode only. It shows a placed section's full metadata,
// its verification state with old versus new values for a changed field, and the
// acknowledge and remove actions. It is anchored to the block with floating-ui, a
// fixed strategy that escapes the panel, and dismisses on an outside click or Escape.
// Escape is intercepted so it closes the popover rather than the whole overlay.

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { Check, Trash2, X } from 'lucide-react';
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import { planStore } from '@/features/plans/planStore';
import { useActiveRun } from '@/features/plans/revalidationStore';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';
import { describeEntryDiff } from './describeEntryDiff';
import { formatExamRange } from './examText';

interface BlockDetailPopoverProps {
  teachTableId: string;
  anchor: HTMLElement;
  locale: Locale;
  t: Translate;
  onClose: () => void;
  onRemove: (teachTableId: string) => void;
  /** Exam window overlaps this block has with other entries, listed as a distinct
   * section so the reason reads apart from a revalidation change. */
  examOverlaps?: ExamOverlap[];
}

export function BlockDetailPopover({
  teachTableId,
  anchor,
  locale,
  t,
  onClose,
  onRemove,
  examOverlaps = [],
}: BlockDetailPopoverProps) {
  const entries = useStore(planStore, (state) => state.entries);
  const run = useActiveRun();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const entry = entries.find((item) => item.teachTableId === teachTableId);

  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (next) => {
      if (!next) {
        onClose();
      }
    },
    strategy: 'fixed',
    placement: 'right-start',
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    elements: { reference: anchor },
    whileElementsMounted: autoUpdate,
  });
  const { getFloatingProps } = useInteractions([useDismiss(context)]);
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
      wrapperRef.current = node;
    },
    [refs],
  );

  // Escape closes the popover only; the overlay focus trap would otherwise close the
  // whole panel first. Focus the popover on open so a keyboard user lands inside it.
  useEffect(() => {
    const node = wrapperRef.current;
    if (node === null) {
      return undefined;
    }
    node.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Close if the entry left the plan while the popover was open.
  useEffect(() => {
    if (entry === undefined) {
      onClose();
    }
  }, [entry, onClose]);

  if (entry === undefined) {
    return null;
  }

  const snapshot = entry.snapshot;
  const name =
    locale === 'th' ? snapshot.subjectMeta.nameTh : snapshot.subjectMeta.nameEn;
  const teachers = locale === 'th' ? snapshot.teachersTh : snapshot.teachersEn;
  const badge = blockBadge(entry.verifyStatus, false);
  const badgeText = blockBadgeLabelKeys(entry.verifyStatus, false)
    .map((key) => t(key))
    .join(' ');
  const diff = run?.report?.entries.find(
    (item) => item.teachTableId === teachTableId,
  );
  const rows = diff === undefined ? [] : describeEntryDiff(diff, locale, t);

  return (
    <div
      ref={setFloating}
      role="dialog"
      aria-label={`${entry.subjectId} ${name}`}
      tabIndex={-1}
      style={floatingStyles}
      {...getFloatingProps()}
      className="z-[2147483647] w-72 rounded-kcp border border-border bg-surface p-3 text-xs text-ink shadow-kcp outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {entry.subjectId} {t('section.code')} {entry.section}
          </p>
          <p className="truncate text-ink-soft">{name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('action.close')}
          className="rounded-kcp p-0.5 text-ink-soft outline-none hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {badge !== null && badgeText !== '' ? (
        <p
          className={`mt-1 font-medium ${badge === 'danger' ? 'text-danger' : 'text-warn'}`}
        >
          {badgeText}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col">
              <dt className="text-ink-soft">{row.label}</dt>
              <dd>
                <span className="text-ink-soft line-through">{row.old}</span>{' '}
                <span className="text-ink">{row.next}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {examOverlaps.length > 0 ? (
        <section
          aria-label={t('verify.examOverlap')}
          className="mt-2 flex flex-col gap-1 border-t border-border pt-2"
        >
          <p className="font-medium text-warn">{t('verify.examOverlap')}</p>
          {examOverlaps.map((overlap) => (
            <div
              key={`${overlap.kind}-${overlap.blocking.teachTableId}`}
              className="flex flex-col text-ink-soft"
            >
              <span>{t(`exam.${overlap.kind}`)}</span>
              <span className="text-ink">
                {formatExamRange(overlap.self, t)}
              </span>
              <span>
                {overlap.blocking.subjectId} {t('section.code')}{' '}
                {overlap.blocking.section}: {formatExamRange(overlap.other, t)}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      <div className="mt-2 flex flex-col gap-0.5 border-t border-border pt-2 text-ink-soft">
        {teachers.length > 0 ? <p>{teachers.join(', ')}</p> : null}
        {snapshot.remark !== '' ? <p>{snapshot.remark}</p> : null}
      </div>

      <div className="mt-2 flex justify-end gap-2 border-t border-border pt-2">
        {entry.verifyStatus === 'changed' ? (
          <button
            type="button"
            onClick={() => {
              planStore.getState().acknowledge(teachTableId);
            }}
            className="inline-flex items-center gap-1 rounded-kcp border border-border px-2 py-1 font-medium text-ink outline-none hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Check size={12} aria-hidden />
            {t('block.acknowledge')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onRemove(teachTableId);
            onClose();
          }}
          className="inline-flex items-center gap-1 rounded-kcp border border-danger px-2 py-1 font-medium text-danger outline-none hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Trash2 size={12} aria-hidden />
          {t('action.remove')}
        </button>
      </div>
    </div>
  );
}
