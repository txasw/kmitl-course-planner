// The tick list of the suggestion dialog (ADR-0054, as amended): the subjects a
// suggestion fits. The ticked set is the whole subject count, so the list carries no
// separate number. It splits the result into the group 2 curriculum subjects, ticked
// and open by default, and every other course, unticked and collapsed by default, so a
// long GenEd list stays out of the way until the student wants one of it. Each group
// heading is a disclosure and sits beside a tick all or untick all action, never
// inside it. A row is a native checkbox inside its label, so the whole row is the
// target and every name wraps in full. The dialog holds which groups are open, beside
// the ticks, so a group the student expanded stays expanded while the student pages the
// suggestions or they are ranked again.

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Course } from '@/lib/domain/types';
import type { Locale, Translate, TranslationKey } from '@/lib/i18n/t';
import { fillTemplate } from '@/lib/i18n/template';
import type { SuggestSubjectGroups } from '@/lib/planner/suggestSubjects';
import { FOCUS_OUTLINE, FOCUS_RING } from '@/lib/ui/focus';
import { TARGET_HEIGHT, TARGET_SIZE } from '@/lib/ui/target';

type GroupKind = keyof SuggestSubjectGroups;

/** Which tick list groups are expanded. */
export type SuggestGroupOpen = Readonly<Record<GroupKind, boolean>>;

/** The curriculum group opens expanded and every other course collapsed. */
export const DEFAULT_GROUP_OPEN: SuggestGroupOpen = {
  curriculum: true,
  other: false,
};

const HEADING_KEY: Record<GroupKind, TranslationKey> = {
  curriculum: 'suggest.subjects.curriculum',
  other: 'suggest.subjects.other',
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
            <ChevronDown
              size={14}
              aria-hidden
              className={`shrink-0 transition-transform duration-fast motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
            />
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
          className={`rounded-kcp px-2 text-xs text-primary-strong hover:bg-surface ${TARGET_SIZE} ${FOCUS_RING}`}
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
                  className={`row-span-2 mt-0.5 size-4 accent-primary-strong ${FOCUS_OUTLINE}`}
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

interface SuggestSubjectsProps {
  groups: SuggestSubjectGroups;
  ticked: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  open: SuggestGroupOpen;
  onOpenChange: (next: SuggestGroupOpen) => void;
  locale: Locale;
  t: Translate;
}

export function SuggestSubjects({
  groups,
  ticked,
  onChange,
  open,
  onOpenChange,
  locale,
  t,
}: SuggestSubjectsProps) {
  const labelId = useId();
  const tickedCount = [...groups.curriculum, ...groups.other].filter((course) =>
    ticked.has(course.subjectId),
  ).length;
  const kinds = (['curriculum', 'other'] as const).filter(
    (kind) => groups[kind].length > 0,
  );
  if (kinds.length === 0) {
    return null;
  }
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-ink-soft">
        <span id={labelId}>{t('suggest.subjects')}</span>
        <span>
          {fillTemplate(t('suggest.subjects.ticked'), { count: tickedCount })}
        </span>
      </div>
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
  );
}
