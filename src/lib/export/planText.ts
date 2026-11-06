// The plain text schedule for chat apps such as LINE, which render no markdown.
// It is a pure formatter so the preview toolbar and its tests share one output.
// Meetings are ordered Sunday through Saturday then by start time; each line
// carries the day abbreviation, the time range, the subject id and name, the
// section in parentheses, and the room, honouring the display options. Unscheduled
// sections follow under a label without a day or time so a shared plan never hides
// the credits they carry, and a missing entry keeps a short parenthetical marker so
// the text is honest about what upstream no longer lists; a chat message has no footer
// to carry the poster's data line, so the marker stays on the line it describes
// (ADR-0055). A header line names the plan, its term, and total credits; a footer line
// names the app.

import type { Meeting } from '../domain/types';
import type { VerifyStatus } from '../domain/plan';
import type { DisplayOptions } from '../planner/displayOptions';
import { summarizeCredits } from '../planner/credits';
import type { Locale, Translate } from '../i18n/t';
import { dayLabelKey } from '../i18n/dayLabel';
import { formatMinutes } from '../parsing/time';

/** The section fields the text export reads; PlacedSection satisfies it structurally. */
export interface PlanTextSection {
  subjectId: string;
  nameTh: string;
  nameEn: string;
  section: string;
  credit: number;
  verifyStatus: VerifyStatus;
  meetings: Meeting[];
}

export interface PlanTextInput {
  planName: string;
  year: string;
  semester: string;
  sections: PlanTextSection[];
  options: DisplayOptions;
  locale: Locale;
  t: Translate;
}

/** The subject fields a line names; a placed section and an exam schedule row satisfy it. */
export interface SubjectNames {
  subjectId: string;
  nameTh: string;
  nameEn: string;
}

/** A subject as every line of the text export and the poster exam block names it, honouring
 * the display options: the subject id leads with a trailing space when shown, the locale
 * primary name follows with the English name after a Thai one when shown, and the section
 * codes close in parentheses when shown, so the poster and the text read one wording. */
export function subjectText(
  subject: SubjectNames,
  sections: readonly string[],
  options: DisplayOptions,
  locale: Locale,
): string {
  const id = options.showSubjectId ? `${subject.subjectId} ` : '';
  const primary = locale === 'th' ? subject.nameTh : subject.nameEn;
  const name =
    options.showEnglishNames && locale === 'th' && subject.nameEn !== ''
      ? `${primary} ${subject.nameEn}`
      : primary;
  const codes =
    options.showSection && sections.length > 0
      ? ` (${sections.join(', ')})`
      : '';
  return `${id}${name}${codes}`;
}

function missingPart(section: PlanTextSection, t: Translate): string {
  return section.verifyStatus === 'missing'
    ? ` (${t('revalidation.missing')})`
    : '';
}

export function formatPlanText(input: PlanTextInput): string {
  const { planName, year, semester, sections, options, locale, t } = input;

  const credits = summarizeCredits(
    sections.map((section) => ({
      subjectId: section.subjectId,
      credit: section.credit,
    })),
  ).credits;
  const header = `${planName}  ${t('search.semester')} ${semester}/${year}  ${String(credits)} ${t('footer.credits')}`;

  const rows = sections
    .filter((section) => section.meetings.length > 0)
    .flatMap((section) =>
      section.meetings.map((meeting) => ({ section, meeting })),
    )
    .sort(
      (a, b) =>
        a.meeting.day - b.meeting.day ||
        a.meeting.startMin - b.meeting.startMin ||
        a.section.subjectId.localeCompare(b.section.subjectId),
    );
  const bodyLines = rows.map(({ section, meeting }) => {
    const time = `${formatMinutes(meeting.startMin)}-${formatMinutes(meeting.endMin)}`;
    const room =
      options.showRoom && meeting.room !== '' ? ` ${meeting.room}` : '';
    return `${t(dayLabelKey(meeting.day))} ${time} ${subjectText(section, [section.section], options, locale)}${room}${missingPart(section, t)}`;
  });

  const unscheduled = sections.filter(
    (section) => section.meetings.length === 0,
  );
  const unscheduledLines = unscheduled.map(
    (section) =>
      `${subjectText(section, [section.section], options, locale)}${missingPart(section, t)}`,
  );

  const blocks: string[] = [header];
  if (bodyLines.length > 0) {
    blocks.push(bodyLines.join('\n'));
  }
  if (unscheduledLines.length > 0) {
    blocks.push([t('shelf.title'), ...unscheduledLines].join('\n'));
  }
  blocks.push(t('app.title'));

  return blocks.join('\n\n');
}
