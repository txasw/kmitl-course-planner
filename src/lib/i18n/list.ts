// A list of values joined as a sentence names them, with the conjunction of the locale, so a
// pair reads "34 and 35" and "34 และ 35" rather than "34 35", which reads as one code. The
// joining words come from the dictionaries rather than Intl.ListFormat, whose Thai pattern
// sets the conjunction against the values with no space between them.
import type { Translate } from './t';
import { fillTemplate } from './template';

/** The values joined with the locale's conjunction: "34", "34 and 35", "34, 35, and 36". */
export function joinList(t: Translate, values: readonly string[]): string {
  const last = values.at(-1);
  if (last === undefined) {
    return '';
  }
  if (values.length === 1) {
    return last;
  }
  if (values.length === 2) {
    return fillTemplate(t('list.pair'), { first: values[0] ?? '', last });
  }
  return fillTemplate(t('list.series'), {
    rest: values.slice(0, -1).join(t('list.separator')),
    last,
  });
}

/** The section codes with their noun in the count's number: "Section 34", "Sections 34 and
 * 35". Thai has no plural form, so both of its keys read กลุ่มเรียน. */
export function sectionCodesLabel(
  t: Translate,
  sections: readonly string[],
): string {
  return fillTemplate(
    t(sections.length === 1 ? 'section.codesOne' : 'section.codes'),
    { list: joinList(t, sections) },
  );
}
