// Count labels with the English singular. Thai has no plural form, so both of its
// keys read the same, while English needs "1 course" rather than "1 courses". Every
// count the panel or an export prints beside a noun goes through here, either as a
// whole label or, where the number carries its own style, as the unit word alone.
import type { Translate, TranslationKey } from './t';
import { fillTemplate } from './template';

/** A unit word and its singular, picked by the count it follows. */
export interface CountUnit {
  one: TranslationKey;
  many: TranslationKey;
}

export const CREDIT_UNIT: CountUnit = {
  one: 'footer.creditOne',
  many: 'footer.credits',
};
export const SUBJECT_UNIT: CountUnit = {
  one: 'footer.subjectOne',
  many: 'footer.subjects',
};
export const COURSE_UNIT: CountUnit = {
  one: 'catalog.units.courseOne',
  many: 'catalog.units.course',
};
export const SECTION_UNIT: CountUnit = {
  one: 'catalog.units.sectionOne',
  many: 'catalog.units.section',
};
export const MERGED_UNIT: CountUnit = {
  one: 'catalog.units.mergedOne',
  many: 'catalog.units.merged',
};
export const MULTI_MEETING_UNIT: CountUnit = {
  one: 'catalog.units.multiMeetingOne',
  many: 'catalog.units.multiMeeting',
};
export const MORE_CONFLICT_UNIT: CountUnit = {
  one: 'feedback.moreConflictOne',
  many: 'feedback.moreConflicts',
};

/** The unit word alone, for a count rendered in its own styled node beside it. */
export function unitWord(t: Translate, n: number, unit: CountUnit): string {
  return t(n === 1 ? unit.one : unit.many);
}

/** The count and its unit word, such as "1 credit" or "3 credits". */
export function countWithUnit(
  t: Translate,
  n: number,
  unit: CountUnit,
): string {
  return `${String(n)} ${unitWord(t, n, unit)}`;
}

export function courseCountLabel(t: Translate, n: number): string {
  return n === 1
    ? t('catalog.group.countOne')
    : fillTemplate(t('catalog.group.count'), { n });
}

export function sectionCountLabel(t: Translate, n: number): string {
  return n === 1
    ? t('catalog.card.sectionCountOne')
    : fillTemplate(t('catalog.card.sectionCount'), { n });
}
