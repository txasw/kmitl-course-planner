// The tick list of the suggestion dialog (ADR-0054, as amended): the subjects a
// suggestion fits. A row of group segments on a sunken track heads it, one per group that
// holds a subject: the subjects already in the plan, the group 2 curriculum subjects of the
// result, and every other course, GenEd and free electives among them. Each segment names
// its group and how many of its subjects are ticked, so the row reads as the summary of the
// whole list, and it is a disclosure for its group's list, one group open at a time, the
// open one raised onto the surface. The dialog opens on the GenEd group, since those start
// unticked and a student would not otherwise see that they can join; the plan and
// curriculum subjects start ticked and their segments say so. The open list shows its
// first rows and a control that shows the rest, so a long GenEd list never pushes the
// suggestions far down. A row is a native checkbox inside its label, so the whole row is
// the target and every name wraps in full; on the wider tiers the rows flow into columns.
// The checkboxes and the tick all action take the ink, so the dialog keeps its orange for
// the apply action alone.
//
// While the plan holds a subject, the label row carries the clear plan action. It asks
// first in the page, naming how many subjects leave, with the cancel taking focus as the
// safe choice; the clear itself is one undoable step. The dialog is modal, so the undo
// toast outside it is no sure way back for a keyboard or screen reader user: while that
// undo is pending the prompt's place holds a line that names the clear and carries its own
// undo. The undo takes focus with the line as its description, so the clear is said on
// arrival inside the modal and the dialog needs no live region of its own (ADR-0048).

import { useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmPrompt } from '@/components/ConfirmPrompt';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import type { Course } from '@/lib/domain/types';
import { countWithUnit, SUBJECT_UNIT } from '@/lib/i18n/counts';
import type { Locale, Translate } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { SuggestSubjectGroups } from '@/lib/planner/suggestSubjects';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT, TARGET_SIZE } from '@/lib/ui/target';
import { commitThenFocus } from '@/features/shell/restoreFocus';
import { UNDO_WINDOW_MS } from '@/features/shell/UndoToast';

export type SuggestGroup = keyof SuggestSubjectGroups;

/** The groups in the order the segments show them. */
const GROUP_ORDER: readonly SuggestGroup[] = ['planned', 'curriculum', 'other'];

/** The group open when the dialog opens: the GenEd and other courses, when there are any. */
export function defaultOpenGroup(
  groups: SuggestSubjectGroups,
): SuggestGroup | null {
  return groups.other.length > 0 ? 'other' : null;
}

function tickedIn(courses: Course[], ticked: ReadonlySet<string>): number {
  return courses.filter((course) => ticked.has(course.subjectId)).length;
}

interface SubjectGroupProps {
  id: string;
  kind: SuggestGroup;
  courses: Course[];
  ticked: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  /** The rows shown before the control that shows the rest. */
  rowCap: number;
  locale: Locale;
  t: Translate;
}

function SubjectGroup({
  id,
  kind,
  courses,
  ticked,
  onChange,
  rowCap,
  locale,
  t,
}: SubjectGroupProps) {
  const nameId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [all, setAll] = useState(false);
  const allTicked = tickedIn(courses, ticked) === courses.length;
  // One hidden row is shown rather than hidden behind a control that reveals one row.
  const shown =
    all || courses.length <= rowCap + 1 ? courses : courses.slice(0, rowCap);
  const hidden = courses.length - shown.length;

  const handleToggle = (subjectId: string) => {
    const next = new Set(ticked);
    if (next.has(subjectId)) {
      next.delete(subjectId);
    } else {
      next.add(subjectId);
    }
    onChange(next);
  };
  const handleAll = () => {
    const next = new Set(ticked);
    for (const course of courses) {
      if (allTicked) {
        next.delete(course.subjectId);
      } else {
        next.add(course.subjectId);
      }
    }
    onChange(next);
  };
  // The control leaves with the rows it reveals, so focus moves to the first of them.
  const handleMore = () => {
    commitThenFocus(
      () => {
        setAll(true);
      },
      () => [listRef.current?.querySelectorAll('input').item(rowCap)],
    );
  };

  return (
    <section
      id={id}
      aria-labelledby={nameId}
      className="kcp-soft-card kcp-soft-quiet flex flex-col gap-1 p-2"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3
          id={nameId}
          className="min-w-0 flex-1 px-1 text-xs font-semibold text-ink"
        >
          {t(`suggest.group.${kind}`)}
        </h3>
        <button
          type="button"
          aria-describedby={nameId}
          onClick={handleAll}
          className={`rounded-kcp px-2 text-xs text-ink underline decoration-border-strong underline-offset-2 hover:bg-surface-alt ${TARGET_SIZE} ${FOCUS_RING}`}
        >
          {t(
            allTicked
              ? 'suggest.subjects.untickAll'
              : 'suggest.subjects.tickAll',
          )}
        </button>
      </div>
      <div ref={listRef} className="grid gap-x-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((course) => (
          <label
            key={course.subjectId}
            className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 rounded-kcp px-1 py-1.5 hover:bg-surface-alt ${TARGET_HEIGHT}`}
          >
            <input
              type="checkbox"
              checked={ticked.has(course.subjectId)}
              onChange={() => {
                handleToggle(course.subjectId);
              }}
              className={`row-span-2 mt-0.5 size-4 accent-ink ${FOCUS_OUTLINE}`}
            />
            <span className="text-sm break-words text-ink">
              {locale === 'th' ? course.nameTh : course.nameEn}
            </span>
            <span className="flex flex-wrap gap-x-2 text-xs text-ink-soft">
              <span>{course.subjectId}</span>
              <span>{course.creditStr}</span>
            </span>
          </label>
        ))}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={handleMore}
          className={`self-start rounded-kcp px-1 text-sm text-ink underline decoration-border-strong underline-offset-2 hover:bg-surface-alt ${TARGET_HEIGHT} ${FOCUS_RING}`}
        >
          {fillTemplate(t('suggest.subjects.more'), { count: hidden })}
        </button>
      ) : null}
    </section>
  );
}

interface SuggestSubjectsProps {
  groups: SuggestSubjectGroups;
  ticked: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  /** The group whose list shows under the segments, or null when none does. */
  open: SuggestGroup | null;
  onOpenChange: (next: SuggestGroup | null) => void;
  /** The rows an open list shows before the control that shows the rest. */
  rowCap: number;
  /** Remove every subject from the active plan, as one undoable step. */
  onClear: () => void;
  /** The subjects a pending clear took out, or null while no clear can be undone. */
  cleared: number | null;
  onUndoClear: () => void;
  locale: Locale;
  t: Translate;
}

export function SuggestSubjects({
  groups,
  ticked,
  onChange,
  open,
  onOpenChange,
  rowCap,
  onClear,
  cleared,
  onUndoClear,
  locale,
  t,
}: SuggestSubjectsProps) {
  const labelId = useId();
  const panelId = useId();
  const clearedId = useId();
  const clearRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const segmentsRef = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const kinds = GROUP_ORDER.filter((kind) => groups[kind].length > 0);
  if (kinds.length === 0) {
    return null;
  }
  const planCount = groups.planned.length;
  // A group that empties, as the plan group does on a clear, hands the list back to the
  // one the dialog opens on, so the segment row never heads nothing.
  const openKind =
    open === null
      ? null
      : kinds.includes(open)
        ? open
        : defaultOpenGroup(groups);

  // The clear control, the prompt, and the cleared line replace each other, so each hand
  // off names where focus lands: the cancel, back on the clear control, or the cleared
  // line's undo, with the first segment as the fallback once nothing else is left.
  const toggleConfirm = (next: boolean, target: () => HTMLElement | null) => {
    commitThenFocus(
      () => {
        setConfirming(next);
      },
      () => [target()],
    );
  };
  const handleClear = () => {
    commitThenFocus(
      () => {
        onClear();
        setConfirming(false);
      },
      () => [undoRef.current, segmentsRef.current?.querySelector('button')],
    );
  };
  const handleUndo = () => {
    commitThenFocus(onUndoClear, () => [
      clearRef.current,
      segmentsRef.current?.querySelector('button'),
    ]);
  };

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-2">
        <span id={labelId} className="text-xs text-ink-soft">
          {t('suggest.subjects')}
        </span>
        {planCount > 0 && !confirming ? (
          <button
            ref={clearRef}
            type="button"
            onClick={() => {
              toggleConfirm(true, () => cancelRef.current);
            }}
            className={`inline-flex items-center gap-1 rounded-kcp px-1 text-xs text-danger underline underline-offset-2 hover:bg-danger-soft ${TARGET_SIZE} ${FOCUS_RING}`}
          >
            <Trash2 size={14} strokeWidth={2} aria-hidden />
            {t('suggest.clear')}
          </button>
        ) : null}
      </div>
      {confirming && planCount > 0 ? (
        <div className="rounded-kcp border border-danger bg-danger-soft p-3 text-sm">
          <ConfirmPrompt
            message={fillTemplate(t('suggest.clear.prompt'), {
              subjects: countWithUnit(t, planCount, SUBJECT_UNIT),
              seconds: UNDO_WINDOW_MS / 1000,
            })}
            confirmLabel={t('suggest.clear.confirm')}
            cancelRef={cancelRef}
            onCancel={() => {
              toggleConfirm(false, () => clearRef.current);
            }}
            onConfirm={handleClear}
          />
        </div>
      ) : cleared !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-x-2 rounded-kcp border border-border bg-surface-alt py-1 pr-1 pl-3 text-sm">
          <p id={clearedId} className="text-ink">
            {fillTemplate(t('feedback.cleared'), {
              subjects: countWithUnit(t, cleared, SUBJECT_UNIT),
            })}
          </p>
          <button
            ref={undoRef}
            type="button"
            aria-describedby={clearedId}
            onClick={handleUndo}
            className={`rounded-kcp px-1 text-primary-strong underline ${TARGET_SIZE} ${FOCUS_RING}`}
          >
            {t('action.undo')}
          </button>
        </div>
      ) : null}
      <div
        ref={segmentsRef}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-kcp bg-surface-sunken p-1"
      >
        {kinds.map((kind) => {
          const expanded = kind === openKind;
          return (
            <button
              key={kind}
              type="button"
              aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              onClick={() => {
                onOpenChange(expanded ? null : kind);
              }}
              className={`flex min-w-0 flex-col items-start gap-0.5 rounded-kcp-sm px-2 py-1.5 text-left ${TARGET_HEIGHT} ${FOCUS_RING} ${
                expanded
                  ? 'bg-surface text-ink shadow-kcp-soft'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <span className="flex w-full items-start gap-1 text-xs font-semibold">
                <span className="min-w-0 flex-1 break-words">
                  {t(`suggest.segment.${kind}`)}
                </span>{' '}
                <span className="mt-0.5">
                  <DisclosureChevron open={expanded} />
                </span>
              </span>{' '}
              <span className="text-sm text-ink">
                {fillTemplate(t('suggest.subjects.groupCount'), {
                  ticked: tickedIn(groups[kind], ticked),
                  total: groups[kind].length,
                })}
              </span>
            </button>
          );
        })}
      </div>
      {openKind === null ? null : (
        <SubjectGroup
          key={openKind}
          id={panelId}
          kind={openKind}
          courses={groups[openKind]}
          ticked={ticked}
          onChange={onChange}
          rowCap={rowCap}
          locale={locale}
          t={t}
        />
      )}
    </div>
  );
}
