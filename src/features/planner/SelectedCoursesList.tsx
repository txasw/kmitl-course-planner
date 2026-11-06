// The selected courses view of ADR-0049: the plan as a list, one card per placed subject,
// so touch, keyboard, and screen reader users manage the plan without the grid. A card
// carries the subject id, the locale primary name with the other language beneath, and
// the credit string, then for each placed section of the subject its section code, the
// verification pill, the compact section detail list, and the enrollment conditions. Like
// the grid it renders only from the plan snapshots. The cards are list items and not
// articles, since the catalog course cards own the article role. Removing a card removes
// the subject, both halves of a pair at once, so its remove control names every section
// it takes out. Focus then moves to the next card's heading, or to the list heading when
// no card follows, so focus never falls back to the page.

import { useId, useRef } from 'react';
import { ListChecks } from 'lucide-react';
import type { PlanEntry } from '@/lib/domain/plan';
import { snapshotToSection } from '@/lib/domain/plan';
import type { Locale, Translate } from '@/lib/i18n/t';
import { FOCUS_RING } from '@/lib/ui/focus';
import { EmptyState } from '@/components/EmptyState';
import { RulesNotice } from '@/features/catalog/RulesNotice';
import {
  RemoveButton,
  removeSectionName,
} from '@/features/catalog/RemoveButton';
import { SectionDetailList } from './SectionDetailList';
import { VerificationPill } from './VerificationPill';

/** The placed sections of one subject: one section, or the two halves of a pair. */
export interface SubjectGroup {
  subjectId: string;
  entries: PlanEntry[];
}

const byCode = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

/** Group the plan entries by subject, ordered by subject id, each subject's sections
 * ordered by section code. */
export function groupEntriesBySubject(entries: PlanEntry[]): SubjectGroup[] {
  const groups = new Map<string, PlanEntry[]>();
  for (const entry of entries) {
    const subjectId = entry.snapshot.subjectId;
    groups.set(subjectId, [...(groups.get(subjectId) ?? []), entry]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => byCode(a, b))
    .map(([subjectId, grouped]) => ({
      subjectId,
      entries: [...grouped].sort((a, b) =>
        byCode(a.snapshot.section, b.snapshot.section),
      ),
    }));
}

interface SelectedCoursesListProps {
  groups: SubjectGroup[];
  locale: Locale;
  t: Translate;
  onRemove: (teachTableId: string) => void;
  /** teachTableIds a time change put into conflict with another entry. */
  conflictIds: Set<string>;
  /** teachTableIds whose exam window overlaps another entry's. */
  examConflictIds: Set<string>;
}

export function SelectedCoursesList({
  groups,
  locale,
  t,
  onRemove,
  conflictIds,
  examConflictIds,
}: SelectedCoursesListProps) {
  const id = useId();
  const headingId = `${id}-heading`;
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const cardHeadingRefs = useRef(new Map<string, HTMLHeadingElement>());

  const handleRemove = (index: number) => {
    const group = groups[index];
    if (group === undefined) {
      return;
    }
    // Focus moves before the removal, while the removed card's control still holds it,
    // to a heading that outlives the removal.
    const next = groups[index + 1];
    const target =
      next === undefined
        ? listHeadingRef.current
        : cardHeadingRefs.current.get(next.subjectId);
    target?.focus();
    // A pair removes both halves from either one; the call for a half already gone is a
    // no op, so a subject whose sections are not a declared pair still leaves whole.
    for (const entry of group.entries) {
      onRemove(entry.teachTableId);
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-3xl flex-col gap-2"
    >
      <h3
        ref={listHeadingRef}
        id={headingId}
        tabIndex={-1}
        className={`rounded-kcp text-sm font-semibold text-ink ${FOCUS_RING}`}
      >
        {t('selected.title')}
      </h3>
      {groups.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={t('selected.emptyTitle')}
          description={t('selected.emptyBody')}
        />
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col gap-2">
          {groups.map((group, index) => (
            <SubjectCard
              key={group.subjectId}
              group={group}
              locale={locale}
              t={t}
              conflictIds={conflictIds}
              examConflictIds={examConflictIds}
              headingRef={(node) => {
                if (node === null) {
                  cardHeadingRefs.current.delete(group.subjectId);
                } else {
                  cardHeadingRefs.current.set(group.subjectId, node);
                }
              }}
              onRemove={() => {
                handleRemove(index);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface SubjectCardProps {
  group: SubjectGroup;
  locale: Locale;
  t: Translate;
  conflictIds: Set<string>;
  examConflictIds: Set<string>;
  headingRef: (node: HTMLHeadingElement | null) => void;
  onRemove: () => void;
}

function SubjectCard({
  group,
  locale,
  t,
  conflictIds,
  examConflictIds,
  headingRef,
  onRemove,
}: SubjectCardProps) {
  const first = group.entries[0];
  if (first === undefined) {
    return null;
  }
  const meta = first.snapshot.subjectMeta;
  const primary = locale === 'th' ? meta.nameTh : meta.nameEn;
  const secondary = locale === 'th' ? meta.nameEn : meta.nameTh;
  const secondaryLang: Locale = locale === 'th' ? 'en' : 'th';
  const hasSecondary = secondary !== '' && secondary !== primary;

  return (
    <li className="rounded-kcp border border-border bg-surface px-3 py-2">
      <div className="flex items-start gap-2">
        <h4
          ref={headingRef}
          tabIndex={-1}
          className={`min-w-0 flex-1 break-words rounded-kcp text-sm text-ink ${FOCUS_RING}`}
        >
          <span className="font-semibold tabular-nums">{group.subjectId}</span>{' '}
          {primary}
        </h4>
        <span className="shrink-0 pt-0.5 text-xs text-ink-soft tabular-nums">
          {meta.creditStr}
        </span>
        <RemoveButton
          label={t('action.remove')}
          accessibleName={removeSectionName(
            t,
            group.subjectId,
            group.entries.map((entry) => entry.snapshot.section).join(' '),
          )}
          onRemove={onRemove}
        />
      </div>
      {hasSecondary ? (
        <p lang={secondaryLang} className="break-words text-xs text-ink-soft">
          {secondary}
        </p>
      ) : null}
      <ul className="mt-1 flex flex-col">
        {group.entries.map((entry) => (
          <li
            key={entry.teachTableId}
            className="flex flex-col gap-1 border-t border-border pt-2 first:border-t-0 first:pt-1 [&+li]:mt-2"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-ink">
                {t('section.code')} {entry.snapshot.section}
              </span>
              <VerificationPill
                verifyStatus={entry.verifyStatus}
                conflicted={conflictIds.has(entry.teachTableId)}
                examConflicted={examConflictIds.has(entry.teachTableId)}
                t={t}
              />
            </div>
            <SectionDetailList
              section={snapshotToSection(entry.snapshot)}
              creditStr={meta.creditStr}
              density="compact"
              locale={locale}
              t={t}
            />
            <RulesNotice
              rulesTh={entry.snapshot.rulesTh}
              rulesEn={entry.snapshot.rulesEn}
              locale={locale}
              t={t}
            />
          </li>
        ))}
      </ul>
    </li>
  );
}
