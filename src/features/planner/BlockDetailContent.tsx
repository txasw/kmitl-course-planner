// The content of a placed block's detail surface, shared by the anchored popover and the
// bottom sheet so both carry the same facts and the same actions. The body reads the
// verification state with old versus new values for a changed field, any exam overlap as
// its own section, and the full SectionDetailList. The actions acknowledge a change and
// remove the section; on a sheet they grow to a 44 px touch target.

import { Check, Trash2 } from 'lucide-react';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { PlanEntry } from '@/lib/domain/plan';
import { snapshotToSection } from '@/lib/domain/plan';
import type { ExamOverlap } from '@/lib/planner/examOverlap';
import type { EntryDiff } from '@/lib/planner/revalidate';
import { planStore } from '@/features/plans/planStore';
import { blockBadge, blockBadgeLabelKeys } from './blockBadge';
import { describeEntryDiff } from './describeEntryDiff';
import { formatExamRange } from './examText';
import { SectionDetailList } from './SectionDetailList';

const ACTION =
  'inline-flex items-center gap-1 rounded-kcp border outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface BlockDetailBodyProps {
  entry: PlanEntry;
  diff: EntryDiff | undefined;
  examOverlaps: ExamOverlap[];
  locale: Locale;
  t: Translate;
}

export function BlockDetailBody({
  entry,
  diff,
  examOverlaps,
  locale,
  t,
}: BlockDetailBodyProps) {
  const snapshot = entry.snapshot;
  // The exam overlap folds into the badge like it does on the block, so an entry that
  // both changed and clashes on an exam reads danger and announces both states.
  const examConflicted = examOverlaps.length > 0;
  const badge = blockBadge(entry.verifyStatus, false, examConflicted);
  const badgeText = blockBadgeLabelKeys(
    entry.verifyStatus,
    false,
    examConflicted,
  )
    .map((key) => t(key))
    .join(' ');
  const rows = diff === undefined ? [] : describeEntryDiff(diff, locale, t);

  return (
    <>
      {badge !== null && badgeText !== '' ? (
        <p
          className={`mt-1 font-semibold ${badge === 'danger' ? 'text-danger' : 'text-warn'}`}
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
          <p className="font-semibold text-danger">{t('verify.examOverlap')}</p>
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

      <div className="mt-2 border-t border-border pt-2">
        <SectionDetailList
          section={snapshotToSection(snapshot)}
          creditStr={snapshot.subjectMeta.creditStr}
          density="full"
          locale={locale}
          t={t}
          lastVerifiedAt={entry.lastVerifiedAt}
        />
      </div>
    </>
  );
}

interface BlockDetailActionsProps {
  entry: PlanEntry;
  t: Translate;
  onRemove: (teachTableId: string) => void;
  onClose: () => void;
  /** Size the actions as 44 px touch targets, for the sheet footer. */
  touch: boolean;
}

export function BlockDetailActions({
  entry,
  t,
  onRemove,
  onClose,
  touch,
}: BlockDetailActionsProps) {
  const size = touch ? 'min-h-11 px-3 text-sm' : 'px-2 py-1';
  return (
    <div className="flex justify-end gap-2">
      {entry.verifyStatus === 'changed' ? (
        <button
          type="button"
          onClick={() => {
            planStore.getState().acknowledge(entry.teachTableId);
          }}
          className={`${ACTION} ${size} border-border text-ink hover:bg-surface-alt`}
        >
          <Check size={touch ? 16 : 12} aria-hidden />
          {t('block.acknowledge')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          onRemove(entry.teachTableId);
          onClose();
        }}
        className={`${ACTION} ${size} border-danger text-danger hover:bg-danger-soft`}
      >
        <Trash2 size={touch ? 16 : 12} aria-hidden />
        {t('action.remove')}
      </button>
    </div>
  );
}
