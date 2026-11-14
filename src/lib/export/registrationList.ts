// The plain registration list a student reads from while entering the plan into the
// official registration system, which asks for each subject id and its section codes.
// It is one line per subject in subject id order: the subject id, the locale primary name,
// and in parentheses the section label with each placed section as its kind and code, so
// both halves of a lecture and practice pair travel on the line of their subject. A
// section that upstream no longer lists keeps the same short missing marker the text
// export uses, so the list never reads as current what revalidation could not find. It
// carries no header, footer, or markdown, so the lines paste as they are.

import type { PlanEntry } from '../domain/plan';
import type { Locale, Translate } from '../i18n/t';
import { groupEntriesBySubject } from '../planner/subjectGroups';

function subjectName(entry: PlanEntry, locale: Locale): string {
  const meta = entry.snapshot.subjectMeta;
  const primary = locale === 'th' ? meta.nameTh : meta.nameEn;
  const other = locale === 'th' ? meta.nameEn : meta.nameTh;
  return primary === '' ? other : primary;
}

function sectionText(entry: PlanEntry, t: Translate): string {
  const kind = t(
    entry.snapshot.kind === 'lecture' ? 'section.lecture' : 'section.practice',
  );
  return `${kind} ${entry.snapshot.section}`;
}

/** The registration list of a plan's entries, one line per subject, or an empty string
 * for an empty plan. */
export function formatRegistrationList(
  entries: PlanEntry[],
  locale: Locale,
  t: Translate,
): string {
  return groupEntriesBySubject(entries)
    .flatMap((group) => {
      const first = group.entries[0];
      if (first === undefined) {
        return [];
      }
      const sections = group.entries
        .map((entry) => sectionText(entry, t))
        .join(', ');
      const missing = group.entries.some(
        (entry) => entry.verifyStatus === 'missing',
      )
        ? ` (${t('revalidation.missing')})`
        : '';
      return [
        `${group.subjectId} ${subjectName(first, locale)} (${t('section.code')} ${sections})${missing}`,
      ];
    })
    .join('\n');
}
