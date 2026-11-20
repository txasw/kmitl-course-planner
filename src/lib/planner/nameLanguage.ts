// The language the poster and every export name a subject in: Thai, English, or both. It is
// an export choice apart from the panel language, so a student browsing in Thai can share an
// English timetable, and a choice of both names a subject in the panel language first with
// the other language as a second line. An unset choice follows the panel language, which is
// the default, so an export reads like the screen until the student asks otherwise. This one
// resolver feeds the poster blocks, the unscheduled shelf, the exam block, and the copy as
// text output, so the image and the text always name a subject the same way.

import type { Locale } from '../i18n/t';

export const NAME_LANGUAGES = ['th', 'en', 'both'] as const;
export type NameLanguage = (typeof NAME_LANGUAGES)[number];

/** The subject names a surface reads, in its two languages. */
export interface NamedSubject {
  nameTh: string;
  nameEn: string;
}

/** The names a subject shows: the primary in its language, and an optional second line. */
export interface SubjectNameLines {
  primary: string;
  primaryLang: Locale;
  secondary: string | null;
  secondaryLang: Locale | null;
}

/** The choice in effect: an unset choice follows the panel language. */
export function effectiveNameLanguage(
  choice: NameLanguage | undefined,
  panel: Locale,
): NameLanguage {
  return choice ?? panel;
}

function nameIn(subject: NamedSubject, lang: Locale): string {
  return lang === 'th' ? subject.nameTh : subject.nameEn;
}

function otherLocale(lang: Locale): Locale {
  return lang === 'th' ? 'en' : 'th';
}

/** Name a subject under the choice. A single language falls back to the other language when
 * its own name is empty, so a block is never nameless, and a choice of both leads with the
 * panel language and adds the other only when it is present and differs. */
export function subjectNameLines(
  subject: NamedSubject,
  choice: NameLanguage | undefined,
  panel: Locale,
): SubjectNameLines {
  const effective = effectiveNameLanguage(choice, panel);
  const lead: Locale = effective === 'both' ? panel : effective;
  const leadName = nameIn(subject, lead);
  const other = otherLocale(lead);
  const otherName = nameIn(subject, other);
  if (leadName === '') {
    return {
      primary: otherName,
      primaryLang: other,
      secondary: null,
      secondaryLang: null,
    };
  }
  const second =
    effective === 'both' && otherName !== '' && otherName !== leadName;
  return {
    primary: leadName,
    primaryLang: lead,
    secondary: second ? otherName : null,
    secondaryLang: second ? other : null,
  };
}
