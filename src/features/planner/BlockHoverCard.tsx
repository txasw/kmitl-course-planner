// A hover detail card for a placed block. After a short delay the grid opens this card on
// the hovered block, so a look at the full detail set needs no click; a click or Enter or
// Space on the block still opens the pinned detail popover for actions, and the card never
// spawns while that popover is pinned (ADR-0044). It reads the same plan entry snapshot the
// popover reads, so no new data is plumbed. It is read only: no actions, dismissed on leave
// by the grid, positioned to the side so it never sits under the pointer or over the block's
// remove control. It shares a family look with the drag conflict card but carries a neutral
// info accent, a left border in the brand, so a placed block and a blocked drop read
// differently at a glance.

import { useCallback, useEffect } from 'react';
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react';
import { useStore } from 'zustand';
import type { Locale, Translate } from '@/lib/i18n/t';
import { dayFullLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import { planStore } from '@/features/plans/planStore';
import { usePanelPortal } from '@/features/shell/PanelPortalContext';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';
import { formatExamRange } from './examText';
import type { ExamOverlap } from '@/lib/planner/examOverlap';

interface BlockHoverCardProps {
  teachTableId: string;
  anchor: HTMLElement;
  locale: Locale;
  t: Translate;
  examOverlaps: ExamOverlap[];
  /** Dismiss the card, wired to Escape. Leave dismissal is driven by the grid. */
  onClose: () => void;
}

export function BlockHoverCard({
  teachTableId,
  anchor,
  locale,
  t,
  examOverlaps,
  onClose,
}: BlockHoverCardProps) {
  const entries = useStore(planStore, (state) => state.entries);
  const portalRoot = usePanelPortal();
  const entry = entries.find((item) => item.teachTableId === teachTableId);

  const { refs, floatingStyles } = useFloating({
    strategy: 'fixed',
    placement: 'right-start',
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    elements: { reference: anchor },
    whileElementsMounted: autoUpdate,
  });
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  // Escape dismisses the card without closing the overlay, matched to the popover guard.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  if (entry === undefined) {
    return null;
  }
  const snapshot = entry.snapshot;
  const name =
    locale === 'th' ? snapshot.subjectMeta.nameTh : snapshot.subjectMeta.nameEn;
  const teachers = locale === 'th' ? snapshot.teachersTh : snapshot.teachersEn;
  const badge = blockBadge(entry.verifyStatus, false, examOverlaps.length > 0);
  const badgeText = blockBadgeLabelKeys(
    entry.verifyStatus,
    false,
    examOverlaps.length > 0,
  )
    .map((key) => t(key))
    .join(' ');
  const seatText =
    snapshot.seats.enrolled === 'full'
      ? t('seat.full')
      : snapshot.seats.limit === null
        ? String(snapshot.seats.enrolled)
        : `${String(snapshot.seats.enrolled)}/${String(snapshot.seats.limit)}`;

  const card = (
    <div
      ref={setFloating}
      style={floatingStyles}
      role="tooltip"
      className="pointer-events-none z-[2147483647] flex w-64 flex-col gap-1 rounded-kcp border border-l-2 border-border border-l-primary bg-surface p-2.5 text-xs shadow-kcp"
    >
      <p className="font-semibold text-ink">
        <span>{snapshot.subjectId}</span> {name}
      </p>
      <p className="text-ink-soft">
        {t('section.code')} {snapshot.section} ·{' '}
        {snapshot.kind === 'practice'
          ? t('section.practice')
          : t('section.lecture')}{' '}
        · {snapshot.subjectMeta.creditStr}
      </p>
      <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1 text-ink">
        {snapshot.meetings.map((meeting) => (
          <p
            key={`${String(meeting.day)}-${String(meeting.startMin)}`}
            className="text-ink-soft"
          >
            <span className="text-ink">{t(dayFullLabelKey(meeting.day))}</span>{' '}
            {formatMinutes(meeting.startMin)}-{formatMinutes(meeting.endMin)}
            {[meeting.building, meeting.room].filter((part) => part !== '')
              .length > 0
              ? ` · ${[meeting.building, meeting.room].filter((part) => part !== '').join(' ')}`
              : ''}
          </p>
        ))}
      </div>
      <p className="text-ink-soft">
        {t('seat.label')}: {seatText}
      </p>
      {teachers.length > 0 ? (
        <p className="text-ink-soft">{teachers.join(', ')}</p>
      ) : null}
      {snapshot.exam.midterm !== undefined ? (
        <p className="text-ink-soft">
          {t('exam.midterm')} {formatExamRange(snapshot.exam.midterm, t)}
        </p>
      ) : null}
      {snapshot.exam.final !== undefined ? (
        <p className="text-ink-soft">
          {t('exam.final')} {formatExamRange(snapshot.exam.final, t)}
        </p>
      ) : null}
      {badge !== null && badgeText !== '' ? (
        <p
          className={`font-medium ${badge === 'danger' ? 'text-danger' : 'text-warn'}`}
        >
          {badgeText}
        </p>
      ) : null}
    </div>
  );

  return portalRoot === null ? (
    card
  ) : (
    <FloatingPortal root={portalRoot}>{card}</FloatingPortal>
  );
}
