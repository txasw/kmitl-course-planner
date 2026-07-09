// The plain text schedule for chat apps such as LINE, which render no markdown.
// It is a pure formatter so the preview toolbar and its tests share one output.
// Meetings are ordered Sunday through Saturday then by start time; each line
// carries the day abbreviation, the time range, the subject id and name, the
// section in parentheses, and the room, honouring the display options. Unscheduled
// sections follow under a label without a day or time so a shared plan never hides
// the credits they carry, and a missing entry keeps a short parenthetical marker so
// the text is honest about what upstream no longer lists. A header line names the
// plan, its term, and total credits; a footer line names the app.

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

function subjectName(
  section: PlanTextSection,
  options: DisplayOptions,
  locale: Locale,
): string {
  const primary = locale === 'th' ? section.nameTh : section.nameEn;
  if (options.showEnglishNames && locale === 'th' && section.nameEn !== '') {
    return `${primary} ${section.nameEn}`;
  }
  return primary;
}

function sectionPart(
  section: PlanTextSection,
  options: DisplayOptions,
): string {
  return options.showSection ? ` (${section.section})` : '';
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
    return `${t(dayLabelKey(meeting.day))} ${time} ${section.subjectId} ${subjectName(section, options, locale)}${sectionPart(section, options)}${room}${missingPart(section, t)}`;
  });

  const unscheduled = sections.filter(
    (section) => section.meetings.length === 0,
  );
  const unscheduledLines = unscheduled.map(
    (section) =>
      `${section.subjectId} ${subjectName(section, options, locale)}${sectionPart(section, options)}${missingPart(section, t)}`,
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
