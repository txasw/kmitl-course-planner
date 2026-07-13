// The one place a conflict description becomes localized copy, shared by the reason card
// that follows the pointer and the feedback strip that reports a rejected drop, so the two
// never phrase the same conflict differently. The parts split the headline (which section
// clashes) from the detail (when it clashes) so the reason card can lay them on readable
// lines, while the sentence joins them for the feedback strip.

import type { Translate } from '@/lib/i18n/t';
import type { ConflictDescription } from '@/lib/planner/describeConflict';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import { formatExamRange } from './examText';

export interface ReasonParts {
  /** Which section clashes, e.g. "Conflicts with 90000001 Sec 900". */
  headline: string;
  /** When it clashes, e.g. "Mon 09:00-10:00", or null for a duplicate. */
  detail: string | null;
}

export function conflictReasonParts(
  description: ConflictDescription,
  t: Translate,
): ReasonParts {
  if (description.kind === 'time' && description.day !== null) {
    const range = `${formatMinutes(description.startMin ?? 0)}-${formatMinutes(description.endMin ?? 0)}`;
    return {
      headline: `${t('section.reason.conflictWith')} ${description.subjectId} ${t('section.code')} ${description.section}`,
      detail: `${t(dayLabelKey(description.day))} ${range}`,
    };
  }
  if (
    description.kind === 'exam' &&
    description.examKind !== null &&
    description.examWindow !== null
  ) {
    return {
      headline: `${t('section.reason.examConflictWith')} ${description.subjectId} ${t('section.code')} ${description.section}`,
      detail: `${t(`exam.${description.examKind}`)} ${formatExamRange(description.examWindow, t)}`,
    };
  }
  return { headline: t('section.reason.duplicate'), detail: null };
}

export function conflictReasonText(
  description: ConflictDescription,
  t: Translate,
): string {
  const suffix =
    description.moreCount > 0 ? ` (+${String(description.moreCount)})` : '';
  const { headline, detail } = conflictReasonParts(description, t);
  return `${headline}${detail !== null ? ` ${detail}` : ''}${suffix}`;
}
