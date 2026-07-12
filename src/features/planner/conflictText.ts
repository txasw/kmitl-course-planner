// The one place a conflict description becomes a localized sentence, shared by the
// reason chip that follows the pointer and the feedback strip that reports a
// rejected drop, so the two never phrase the same conflict differently.

import type { Translate } from '@/lib/i18n/t';
import type { ConflictDescription } from '@/lib/planner/describeConflict';
import { dayLabelKey } from '@/lib/i18n/dayLabel';
import { formatMinutes } from '@/lib/parsing/time';
import { formatExamRange } from './examText';

export function conflictReasonText(
  description: ConflictDescription,
  t: Translate,
): string {
  const suffix =
    description.moreCount > 0 ? ` (+${String(description.moreCount)})` : '';
  if (description.kind === 'time' && description.day !== null) {
    const range = `${formatMinutes(description.startMin ?? 0)}-${formatMinutes(description.endMin ?? 0)}`;
    return `${t('section.reason.conflictWith')} ${description.subjectId} ${t('section.code')} ${description.section} ${t(dayLabelKey(description.day))} ${range}${suffix}`;
  }
  if (
    description.kind === 'exam' &&
    description.examKind !== null &&
    description.examWindow !== null
  ) {
    return `${t('section.reason.examConflictWith')} ${description.subjectId} ${t('section.code')} ${description.section} ${t(`exam.${description.examKind}`)} ${formatExamRange(description.examWindow, t)}${suffix}`;
  }
  return `${t('section.reason.duplicate')}${suffix}`;
}
