// The tick list of the suggestion dialog (ADR-0054, as amended): the subjects a
// suggestion fits. It rests as one summary line, collapsed by default, that counts the
// ticked subjects of each group, such as 6 วิชาในตาราง and 4 วิชาในหลักสูตร, each count a
// span of its own with a dot drawn between them rather than typed, so the carousel sits
// near the top of the dialog. The ticked set is the whole subject count, so the list
// carries no separate number. Expanded, it names the subjects already in the plan, such
// as a GenEd added by hand, ticked and open by default, so the student sees what every
// suggestion keeps and can untick one to leave it out; then the group 2 curriculum
// subjects of the result, ticked and open by default; then every other course, unticked
// and collapsed by default, so a long GenEd list stays out of the way until the student
// wants one of it. Each group heading is a disclosure and sits beside a tick all or
// untick all action, never inside it. A row is a native checkbox inside its label, so
// the whole row is the target and every name wraps in full. The checkboxes and the tick
// all actions take the ink, so the dialog keeps its orange for the apply action alone.
// The dialog holds whether the list and each group are open, beside the ticks, so what
// the student expanded stays expanded while the suggestions page or rank again.

import { Fragment, useId } from 'react';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import type { Course } from '@/lib/domain/types';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { SuggestSubjectGroups } from '@/lib/planner/suggestSubjects';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT, TARGET_SIZE } from '@/lib/ui/target';

type GroupKind = keyof SuggestSubjectGroups;

/** Which tick list groups are expanded. */
export type SuggestGroupOpen = Readonly<Record<GroupKind, boolean>>;

/** The plan and curriculum groups open expanded and every other course collapsed. */
export const DEFAULT_GROUP_OPEN: SuggestGroupOpen = {
  planned: true,
  curriculum: true,
  other: false,
};

/** The groups in the order the list shows them. */
const GROUP_ORDER: readonly GroupKind[] = ['planned', 'curriculum', 'other'];

const HEADING_KEY: Record<GroupKind, TranslationKey> = {
  planned: 'suggest.subjects.planned',
  curriculum: 'suggest.subjects.curriculum',
  other: 'suggest.subjects.other',
};

const SUMMARY_KEY: Record<GroupKind, TranslationKey> = {
  planned: 'suggest.summary.planned',
  curriculum: 'suggest.summary.curriculum',
  other: 'suggest.summary.other',
};

interface SubjectGroupProps {
  kind: GroupKind;
  courses: Course[];
  ticked: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  t: Translate;
}

function SubjectGroup({
  kind,
  courses,
  ticked,
  onChange,
  open,
  onOpenChange,
  locale,
  t,
}: SubjectGroupProps) {
  const nameId = useId();
  const listId = useId();
  const tickedHere = courses.filter((course) =>
    ticked.has(course.subjectId),
  ).length;
  const allTicked = tickedHere === courses.length;

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

  return (
    <section
      aria-labelledby={nameId}
      className="flex flex-col gap-1 rounded-kcp bg-surface-alt p-2"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="min-w-0 flex-1 text-xs font-semibold">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            onClick={() => {
              onOpenChange(!open);
            }}
            className={`flex w-full items-center gap-1.5 rounded-kcp px-1 text-left text-ink hover:text-ink-soft ${TARGET_HEIGHT} ${FOCUS_RING}`}
          >
            <DisclosureChevron open={open} />
            <span id={nameId} className="min-w-0 flex-1">
              {t(HEADING_KEY[kind])}
            </span>{' '}
            <span className="shrink-0 font-normal text-ink-soft">
              {fillTemplate(t('suggest.subjects.groupCount'), {
                ticked: tickedHere,
                total: courses.length,
              })}
            </span>
          </button>
        </h3>
        <button
          type="button"
          aria-describedby={nameId}
          onClick={handleAll}
          className={`rounded-kcp px-2 text-xs text-ink underline decoration-border-strong underline-offset-2 hover:bg-surface ${TARGET_SIZE} ${FOCUS_RING}`}
        >
          {t(
            allTicked
              ? 'suggest.subjects.untickAll'
              : 'suggest.subjects.tickAll',
          )}
        </button>
      </div>
      {open ? (
        <div id={listId} className="flex flex-col">
          {courses.map((course) => (
            <div key={course.subjectId}>
              <label
                className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 rounded-kcp px-1 py-1.5 hover:bg-surface ${TARGET_HEIGHT}`}
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
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** The words for a group's ticked count in the summary line. */
function summaryPart(kind: GroupKind, count: number, t: Translate): string {
  if (kind === 'other' && count === 1) {
    return t('suggest.summary.otherOne');
  }
  return fillTemplate(t(SUMMARY_KEY[kind]), { count });
}

interface SuggestSubjectsProps {
  groups: SuggestSubjectGroups;
  ticked: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  /** Whether the groups show below the summary line. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  open: SuggestGroupOpen;
  onOpenChange: (next: SuggestGroupOpen) => void;
  locale: Locale;
  t: Translate;
}

export function SuggestSubjects({
  groups,
  ticked,
  onChange,
  expanded,
  onExpandedChange,
  open,
  onOpenChange,
  locale,
  t,
}: SuggestSubjectsProps) {
  const labelId = useId();
  const listId = useId();
  const kinds = GROUP_ORDER.filter((kind) => groups[kind].length > 0);
  if (kinds.length === 0) {
    return null;
  }
  const parts = kinds.flatMap((kind) => {
    const count = groups[kind].filter((course) =>
      ticked.has(course.subjectId),
    ).length;
    return count === 0 ? [] : [summaryPart(kind, count, t)];
  });
  // The button is named by its label and each count in turn, so the spoken name keeps a
  // break between them wherever the flex layout does not supply one.
  const partId = (index: number) => `${labelId}-part-${String(index)}`;
  const nameIds = [
    labelId,
    ...Array.from({ length: Math.max(parts.length, 1) }, (_, index) =>
      partId(index),
    ),
  ].join(' ');
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <button
        type="button"
        aria-labelledby={nameIds}
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        onClick={() => {
          onExpandedChange(!expanded);
        }}
        className={`grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 rounded-kcp bg-surface-alt px-3 py-2 text-left text-ink hover:text-ink-soft ${TARGET_HEIGHT} ${FOCUS_RING}`}
      >
        <DisclosureChevron open={expanded} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span id={labelId} className="text-xs text-ink-soft">
            {t('suggest.subjects')}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            {parts.length === 0 ? (
              <span id={partId(0)}>{t('suggest.summary.none')}</span>
            ) : (
              parts.map((part, index) => (
                <Fragment key={part}>
                  {index > 0 ? (
                    <span
                      aria-hidden
                      className="size-1 shrink-0 rounded-full bg-ink-muted"
                    />
                  ) : null}
                  <span id={partId(index)}>{part}</span>
                </Fragment>
              ))
            )}
          </span>
        </span>
      </button>
      {expanded ? (
        <div id={listId} className="flex flex-col gap-2">
          {kinds.map((kind) => (
            <SubjectGroup
              key={kind}
              kind={kind}
              courses={groups[kind]}
              ticked={ticked}
              onChange={onChange}
              open={open[kind]}
              onOpenChange={(next) => {
                onOpenChange({ ...open, [kind]: next });
              }}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
