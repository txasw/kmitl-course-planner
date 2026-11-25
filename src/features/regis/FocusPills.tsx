// The pills under the subject in focus on the helper card: the prerequisite grade a
// condition waits for, a condition with no subject id in it, the plan's section of a
// subject the page lists with another one, and a planned code offered under several
// curricula. The condition and several curricula pills keep their label short and carry
// the full sentence as a tooltip on hover and as their description, so nothing long
// shows inline.

import type { ReactNode } from 'react';
import { Hourglass, Layers, ShieldAlert } from 'lucide-react';
import { Pill } from '@/components/Pill';
import { Tooltip } from '@/components/Tooltip';
import { pickLocalized } from '@/lib/i18n/localize';
import { fillTemplate } from '@/lib/i18n/template';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { ChecklistRow } from '@/lib/regis/checklist';
import type { HelperStatus } from '@/lib/regis/helperStatus';
import { conditionIds } from '@/lib/regis/kit';

/** A pill whose full sentence shows as a tooltip and is read as its description. */
function DescribedPill({
  sentence,
  children,
}: {
  sentence: string;
  children: ReactNode;
}) {
  return (
    <Tooltip label={sentence}>
      {(triggerProps, ref) => (
        <span
          ref={ref}
          {...triggerProps}
          aria-description={sentence}
          className="inline-flex"
        >
          {children}
        </span>
      )}
    </Tooltip>
  );
}

interface FocusPillsProps {
  row: ChecklistRow;
  status: HelperStatus;
  /** The prerequisite ids a run or the page named, which come before the kit's. */
  prerequisites: readonly string[];
  /** The plan's section codes, for a subject the page lists with another section. */
  plannedCodes: string;
  locale: Locale;
  t: Translate;
}

export function FocusPills({
  row,
  status,
  prerequisites,
  plannedCodes,
  locale,
  t,
}: FocusPillsProps) {
  const conditions = pickLocalized(
    row.conditionsTh.join(' '),
    row.conditionsEn.join(' '),
    locale,
  );
  const ids =
    prerequisites.length > 0
      ? prerequisites
      : status === 'cond'
        ? conditionIds([...row.conditionsTh, ...row.conditionsEn])
        : [];
  const pills = [
    ids.length > 0 ? (
      <Pill key="grade" tone="warn" icon={<Hourglass size={12} />}>
        {fillTemplate(t('regis.waitGrade'), { ids: ids.join(' ') })}
      </Pill>
    ) : status === 'cond' ? (
      <DescribedPill
        key="cond"
        sentence={fillTemplate(t('regis.reason.conditions'), {
          text: conditions,
        })}
      >
        <Pill tone="warn" icon={<ShieldAlert size={12} />}>
          {t('regis.short.cond')}
        </Pill>
      </DescribedPill>
    ) : null,
    status === 'other' ? (
      <Pill key="plan" tone="neutral">
        {fillTemplate(t('regis.planSection'), { codes: plannedCodes })}
      </Pill>
    ) : null,
    status === 'todo' && row.duplicateCode !== null ? (
      <DescribedPill
        key="dup"
        sentence={fillTemplate(t('regis.reason.duplicate'), {
          code: row.duplicateCode,
        })}
      >
        <Pill tone="neutral" icon={<Layers size={12} />}>
          {t('regis.severalCurricula')}
        </Pill>
      </DescribedPill>
    ) : null,
  ].filter((pill) => pill !== null);
  return pills.length === 0 ? null : (
    <span className="mt-1 flex flex-wrap gap-1">{pills}</span>
  );
}
